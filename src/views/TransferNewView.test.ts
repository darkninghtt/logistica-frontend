import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import * as productsApi from '@/api/products'
import * as api from '@/api/transfers'
import * as warehousesApi from '@/api/warehouses'
import { ApiError } from '@/api/http'
import { piniaSignedInAs } from '@/testing'
import TransferNewView from './TransferNewView.vue'
import type { Product } from '@/types/product'
import type { TransferDetail, WarehouseRef } from '@/types/transfer'
import type { Warehouse } from '@/types/warehouse'

vi.mock('@/api/products')
vi.mock('@/api/transfers')
vi.mock('@/api/warehouses')

const A: WarehouseRef = { id: 'wa', code: 'A', name: 'Bodega A' }
const B: WarehouseRef = { id: 'wb', code: 'B', name: 'Bodega B' }
const assigned: Warehouse = { ...A, active: true, createdAt: '' }
const product: Product = { id: 'p1', sku: 'S1', name: 'Tornillo', unit: 'un', createdAt: '' }

function pageOf<T>(data: T[]) {
  return { data, page: 1, pageSize: 100, total: data.length }
}

const created: TransferDetail = {
  id: 't9',
  status: 'DRAFT',
  origin: A,
  destination: B,
  note: null,
  createdBy: 'u1',
  dispatchedBy: null,
  dispatchedAt: null,
  receivedBy: null,
  receivedAt: null,
  resolvedBy: null,
  resolvedAt: null,
  createdAt: '',
  updatedAt: '',
  items: [],
  events: [],
}

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: TransferNewView },
      { path: '/traspasos', component: TransferNewView },
      { path: '/traspasos/:id', component: TransferNewView },
    ],
  })
  const wrapper = mount(TransferNewView, {
    global: { plugins: [piniaSignedInAs('WAREHOUSE_MANAGER'), router] },
  })
  await flushPromises()
  return { wrapper, router }
}

async function submit(wrapper: Awaited<ReturnType<typeof mountView>>['wrapper']) {
  await wrapper.find('select[name=destinationWarehouseId]').setValue('wb')
  await wrapper.find('select[name=productId-0]').setValue('p1')
  await wrapper.find('input[name=quantity-0]').setValue('8')
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(warehousesApi.listWarehouses).mockResolvedValue(pageOf([assigned]))
  vi.mocked(warehousesApi.listDestinations).mockResolvedValue([A, B])
  vi.mocked(productsApi.listProducts).mockResolvedValue(pageOf([product]))
})

describe('TransferNewView', () => {
  it('muestra el estado de carga mientras llegan las opciones', async () => {
    vi.mocked(warehousesApi.listDestinations).mockReturnValue(new Promise(() => undefined))
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('Cargando bodegas y productos')
  })

  it('si falla la carga muestra el error y permite reintentar', async () => {
    vi.mocked(warehousesApi.listDestinations).mockRejectedValueOnce(
      new ApiError('No se pudo conectar con el servidor', null, null, null),
    )
    const { wrapper } = await mountView()
    expect(wrapper.find('[role=alert]').text()).toContain('No se pudo conectar con el servidor')

    await wrapper.find('[role=alert] button').trigger('click')
    await flushPromises()

    expect(wrapper.find('form').exists()).toBe(true)
  })

  it('sin bodegas asignadas lo dice y no muestra el formulario', async () => {
    vi.mocked(warehousesApi.listWarehouses).mockResolvedValue(pageOf<Warehouse>([]))
    const { wrapper } = await mountView()
    expect(wrapper.find('[data-test=no-origins]').exists()).toBe(true)
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('sin productos lo dice y no muestra el formulario', async () => {
    vi.mocked(productsApi.listProducts).mockResolvedValue(pageOf<Product>([]))
    const { wrapper } = await mountView()
    expect(wrapper.find('[data-test=no-products]').exists()).toBe(true)
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('crea el borrador y va a su detalle', async () => {
    vi.mocked(api.createTransfer).mockResolvedValue(created)
    const { wrapper, router } = await mountView()

    await submit(wrapper)

    expect(api.createTransfer).toHaveBeenCalledWith({
      originWarehouseId: 'wa',
      destinationWarehouseId: 'wb',
      items: [{ productId: 'p1', quantity: 8 }],
    })
    expect(router.currentRoute.value.path).toBe('/traspasos/t9')
  })

  it('si la API rechaza el borrador muestra el error y conserva lo escrito', async () => {
    vi.mocked(api.createTransfer).mockRejectedValue(
      new ApiError('Algún producto del traspaso no existe', 404, 'NOT_FOUND', 'c1'),
    )
    const { wrapper, router } = await mountView()

    await submit(wrapper)

    expect(wrapper.text()).toContain('Algún producto del traspaso no existe')
    expect(router.currentRoute.value.path).not.toBe('/traspasos/t9')
    expect(wrapper.find<HTMLInputElement>('input[name=quantity-0]').element.value).toBe('8')
  })

  it('Cancelar vuelve al listado', async () => {
    const { wrapper, router } = await mountView()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Cancelar')
      ?.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/traspasos')
  })
})
