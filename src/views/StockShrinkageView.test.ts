import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import * as productsApi from '@/api/products'
import * as shrinkageApi from '@/api/stockShrinkages'
import * as warehousesApi from '@/api/warehouses'
import { ApiError } from '@/api/http'
import StockShrinkageView from './StockShrinkageView.vue'
import type { Product } from '@/types/product'
import type { StockShrinkageResult } from '@/types/stockShrinkage'
import type { Warehouse } from '@/types/warehouse'

vi.mock('@/api/products')
vi.mock('@/api/stockShrinkages')
vi.mock('@/api/warehouses')

const warehouse: Warehouse = { id: 'w1', code: 'A', name: 'Bodega A', active: true, createdAt: '' }
const product: Product = { id: 'p1', sku: 'S1', name: 'Tornillo', unit: 'un', createdAt: '' }

function pageOf<T>(data: T[]) {
  return { data, page: 1, pageSize: 100, total: data.length }
}

/** Lo que recibe el jefe de bodega (con costos). */
const managerResult: StockShrinkageResult = {
  stockLevel: {
    productId: 'p1',
    warehouseId: 'w1',
    quantity: 10,
    avgCost: '110.0000',
    totalValue: '1100.0000',
  },
  movement: {
    id: '9',
    productId: 'p1',
    warehouseId: 'w1',
    type: 'SHRINKAGE',
    quantity: 2,
    unitCost: '110.0000',
    balanceQty: 10,
    balanceAvgCost: '110.0000',
    reason: 'DAMAGE: estiba caída',
    transferId: null,
    createdBy: 'u1',
    createdAt: '',
  },
}

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: StockShrinkageView },
      { path: '/stock', component: StockShrinkageView },
    ],
  })
  const wrapper = mount(StockShrinkageView, { global: { plugins: [createPinia(), router] } })
  await flushPromises()
  return wrapper
}

async function submitShrinkage(wrapper: Awaited<ReturnType<typeof mountView>>) {
  await wrapper.find('select[name=warehouseId]').setValue('w1')
  await wrapper.find('select[name=productId]').setValue('p1')
  await wrapper.find('input[name=quantity]').setValue('2')
  await wrapper.find('select[name=reason]').setValue('DAMAGE')
  await wrapper.find('textarea[name=note]').setValue('estiba caída')
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

describe('StockShrinkageView', () => {
  it('muestra el estado de carga mientras llegan las opciones', async () => {
    vi.mocked(warehousesApi.listWarehouses).mockReturnValue(new Promise(() => undefined))
    vi.mocked(productsApi.listProducts).mockReturnValue(new Promise(() => undefined))
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('Cargando bodegas y productos')
  })

  it('sin bodegas asignadas lo dice y no muestra el formulario', async () => {
    vi.mocked(warehousesApi.listWarehouses).mockResolvedValue(pageOf<Warehouse>([]))
    vi.mocked(productsApi.listProducts).mockResolvedValue(pageOf([product]))
    const wrapper = await mountView()
    expect(wrapper.find('[data-test=no-warehouses]').exists()).toBe(true)
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('sin productos lo dice y no muestra el formulario', async () => {
    vi.mocked(warehousesApi.listWarehouses).mockResolvedValue(pageOf([warehouse]))
    vi.mocked(productsApi.listProducts).mockResolvedValue(pageOf<Product>([]))
    const wrapper = await mountView()
    expect(wrapper.find('[data-test=no-products]').exists()).toBe(true)
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('si falla la carga muestra el error y permite reintentar', async () => {
    vi.mocked(warehousesApi.listWarehouses).mockRejectedValue(
      new ApiError('No se pudo conectar con el servidor', null, null, null),
    )
    vi.mocked(productsApi.listProducts).mockResolvedValue(pageOf([product]))
    const wrapper = await mountView()
    expect(wrapper.find('[role=alert]').text()).toContain('No se pudo conectar con el servidor')

    vi.mocked(warehousesApi.listWarehouses).mockResolvedValue(pageOf([warehouse]))
    await wrapper.find('[role=alert] button').trigger('click')
    await flushPromises()
    expect(wrapper.find('form').exists()).toBe(true)
  })

  it('registra la merma y muestra el stock resultante y el motivo', async () => {
    vi.mocked(warehousesApi.listWarehouses).mockResolvedValue(pageOf([warehouse]))
    vi.mocked(productsApi.listProducts).mockResolvedValue(pageOf([product]))
    vi.mocked(shrinkageApi.createStockShrinkage).mockResolvedValue(managerResult)
    const wrapper = await mountView()

    await submitShrinkage(wrapper)

    expect(shrinkageApi.createStockShrinkage).toHaveBeenCalledWith({
      warehouseId: 'w1',
      productId: 'p1',
      quantity: 2,
      reason: 'DAMAGE',
      note: 'estiba caída',
    })
    const status = wrapper.find('[role=status]')
    expect(status.text()).toContain('Merma registrada')
    expect(status.text()).toContain('Stock actual: 10 u')
    expect(status.text()).toContain('$110.0000')
    expect(status.text()).toContain('Daño: estiba caída')
    expect(wrapper.find<HTMLInputElement>('input[name=quantity]').element.value).toBe('')
  })

  it('al OPERATOR (sin costos en la respuesta) no le muestra costos', async () => {
    vi.mocked(warehousesApi.listWarehouses).mockResolvedValue(pageOf([warehouse]))
    vi.mocked(productsApi.listProducts).mockResolvedValue(pageOf([product]))
    vi.mocked(shrinkageApi.createStockShrinkage).mockResolvedValue({
      stockLevel: { productId: 'p1', warehouseId: 'w1', quantity: 10 },
      movement: {
        id: '9',
        productId: 'p1',
        warehouseId: 'w1',
        type: 'SHRINKAGE',
        quantity: 2,
        balanceQty: 10,
        reason: 'DAMAGE',
        transferId: null,
        createdBy: 'u1',
        createdAt: '',
      },
    })
    const wrapper = await mountView()

    await submitShrinkage(wrapper)

    const status = wrapper.find('[role=status]')
    expect(status.text()).toContain('Stock actual: 10 u')
    expect(status.text()).not.toContain('$')
    expect(status.text()).not.toContain('Costo promedio')
  })

  it('con stock insuficiente muestra el error de la API y conserva lo escrito', async () => {
    vi.mocked(warehousesApi.listWarehouses).mockResolvedValue(pageOf([warehouse]))
    vi.mocked(productsApi.listProducts).mockResolvedValue(pageOf([product]))
    vi.mocked(shrinkageApi.createStockShrinkage).mockRejectedValue(
      new ApiError(
        'No hay stock suficiente en la bodega para registrar la merma',
        409,
        'INSUFFICIENT_STOCK',
        'c1',
      ),
    )
    const wrapper = await mountView()

    await submitShrinkage(wrapper)

    expect(wrapper.text()).toContain('No hay stock suficiente')
    expect(wrapper.find('[role=status]').exists()).toBe(false)
    expect(wrapper.find<HTMLInputElement>('input[name=quantity]').element.value).toBe('2')
  })
})
