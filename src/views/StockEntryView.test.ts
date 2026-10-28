import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import * as productsApi from '@/api/products'
import * as stockApi from '@/api/stockEntries'
import * as warehousesApi from '@/api/warehouses'
import { ApiError } from '@/api/http'
import StockEntryView from './StockEntryView.vue'
import type { Product } from '@/types/product'
import type { Warehouse } from '@/types/warehouse'

vi.mock('@/api/products')
vi.mock('@/api/stockEntries')
vi.mock('@/api/warehouses')

const warehouse: Warehouse = { id: 'w1', code: 'A', name: 'Bodega A', active: true, createdAt: '' }
const product: Product = { id: 'p1', sku: 'S1', name: 'Tornillo', unit: 'un', createdAt: '' }

function pageOf<T>(data: T[]) {
  return { data, page: 1, pageSize: 100, total: data.length }
}

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: StockEntryView }],
  })
  const wrapper = mount(StockEntryView, { global: { plugins: [createPinia(), router] } })
  await flushPromises()
  return wrapper
}

async function submitEntry(wrapper: Awaited<ReturnType<typeof mountView>>) {
  await wrapper.find('select[name=warehouseId]').setValue('w1')
  await wrapper.find('select[name=productId]').setValue('p1')
  await wrapper.find('input[name=quantity]').setValue('10')
  await wrapper.find('input[name=unitCost]').setValue('120')
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

describe('StockEntryView', () => {
  it('muestra el estado de carga mientras llegan las opciones', async () => {
    vi.mocked(warehousesApi.listWarehouses).mockReturnValue(new Promise(() => undefined))
    vi.mocked(productsApi.listProducts).mockReturnValue(new Promise(() => undefined))
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('Cargando bodegas y productos')
  })

  it('si faltan bodegas o productos, lo dice y enlaza a crearlos', async () => {
    vi.mocked(warehousesApi.listWarehouses).mockResolvedValue(pageOf<Warehouse>([]))
    vi.mocked(productsApi.listProducts).mockResolvedValue(pageOf([product]))
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('hace falta al menos una bodega y un producto')
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

  it('registra la entrada y muestra el stock y el costo promedio resultantes', async () => {
    vi.mocked(warehousesApi.listWarehouses).mockResolvedValue(pageOf([warehouse]))
    vi.mocked(productsApi.listProducts).mockResolvedValue(pageOf([product]))
    vi.mocked(stockApi.createStockEntry).mockResolvedValue({
      stockLevel: {
        productId: 'p1',
        warehouseId: 'w1',
        quantity: 20,
        avgCost: '110.0000',
        totalValue: '2200.0000',
      },
      movement: {
        id: '2',
        productId: 'p1',
        warehouseId: 'w1',
        type: 'ENTRY',
        quantity: 10,
        unitCost: '120.0000',
        balanceQty: 20,
        balanceAvgCost: '110.0000',
        reason: null,
        transferId: null,
        createdBy: 'u1',
        createdAt: '',
      },
    })
    const wrapper = await mountView()

    await submitEntry(wrapper)

    expect(stockApi.createStockEntry).toHaveBeenCalledWith({
      warehouseId: 'w1',
      productId: 'p1',
      quantity: 10,
      unitCost: '120',
    })
    const status = wrapper.find('[role=status]')
    expect(status.text()).toContain('Entrada registrada')
    expect(status.text()).toContain('20')
    expect(status.text()).toContain('$110.0000')
    expect(wrapper.find<HTMLInputElement>('input[name=quantity]').element.value).toBe('')
  })

  it('si la API devuelve un error lo muestra y conserva lo escrito', async () => {
    vi.mocked(warehousesApi.listWarehouses).mockResolvedValue(pageOf([warehouse]))
    vi.mocked(productsApi.listProducts).mockResolvedValue(pageOf([product]))
    vi.mocked(stockApi.createStockEntry).mockRejectedValue(
      new ApiError('La bodega no existe', 404, 'NOT_FOUND', 'c1'),
    )
    const wrapper = await mountView()

    await submitEntry(wrapper)

    expect(wrapper.text()).toContain('La bodega no existe')
    expect(wrapper.find('[role=status]').exists()).toBe(false)
    expect(wrapper.find<HTMLInputElement>('input[name=quantity]').element.value).toBe('10')
  })
})
