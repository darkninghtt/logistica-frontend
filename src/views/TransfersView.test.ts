import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import * as productsApi from '@/api/products'
import * as api from '@/api/transfers'
import * as warehousesApi from '@/api/warehouses'
import { ApiError } from '@/api/http'
import { piniaSignedInAs } from '@/testing'
import TransfersView from './TransfersView.vue'
import type { Role } from '@/types/auth'
import type { TransferSummary, WarehouseRef } from '@/types/transfer'

vi.mock('@/api/products')
vi.mock('@/api/transfers')
vi.mock('@/api/warehouses')

const A: WarehouseRef = { id: 'wa', code: 'A', name: 'Bodega A' }
const B: WarehouseRef = { id: 'wb', code: 'B', name: 'Bodega B' }

function transfer(id: string, status: TransferSummary['status'] = 'DRAFT'): TransferSummary {
  return {
    id,
    status,
    origin: A,
    destination: B,
    itemCount: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function pageOf(data: TransferSummary[], page = 1, total = data.length) {
  return { data, page, pageSize: 10, total }
}

async function mountView(role: Role = 'WAREHOUSE_MANAGER') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: TransfersView },
      { path: '/traspasos/nuevo', component: TransfersView },
      { path: '/traspasos/:id', component: TransfersView },
    ],
  })
  const wrapper = mount(TransfersView, { global: { plugins: [piniaSignedInAs(role), router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(warehousesApi.listWarehouses).mockResolvedValue({
    data: [],
    page: 1,
    pageSize: 100,
    total: 0,
  })
  vi.mocked(warehousesApi.listDestinations).mockResolvedValue([A, B])
  vi.mocked(productsApi.listProducts).mockResolvedValue({
    data: [],
    page: 1,
    pageSize: 100,
    total: 0,
  })
})

describe('TransfersView', () => {
  it('muestra el estado de carga mientras llega el listado', async () => {
    vi.mocked(api.listTransfers).mockReturnValue(new Promise(() => undefined))
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('Cargando traspasos')
  })

  it('muestra los traspasos con su estado en español, bodegas y enlace al detalle', async () => {
    vi.mocked(api.listTransfers).mockResolvedValue(
      pageOf([transfer('t1'), transfer('t2', 'IN_TRANSIT')], 1, 12),
    )
    const wrapper = await mountView()

    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.text()).toContain('A · Bodega A')
    expect(rows[0]?.text()).toContain('B · Bodega B')
    expect(rows[0]?.text()).toContain('Borrador')
    expect(rows[1]?.text()).toContain('En tránsito')
    expect(rows[0]?.find('a').attributes('href')).toBe('/traspasos/t1')
    expect(wrapper.text()).toContain('Página 1 de 2 (12 traspasos)')
  })

  it('sin traspasos lo dice', async () => {
    vi.mocked(api.listTransfers).mockResolvedValue(pageOf([]))
    const wrapper = await mountView()
    expect(wrapper.find('[data-test=empty]').text()).toContain('Todavía no hay traspasos')
  })

  it('con filtros y sin resultados lo dice distinto', async () => {
    vi.mocked(api.listTransfers).mockResolvedValue(pageOf([]))
    const wrapper = await mountView()

    await wrapper.find('select[name=status]').setValue('CANCELLED')
    await flushPromises()

    expect(wrapper.find('[data-test=empty]').text()).toContain('No hay traspasos con esos filtros')
  })

  it('si falla la carga muestra el error y permite reintentar', async () => {
    vi.mocked(api.listTransfers).mockRejectedValue(
      new ApiError('No se pudo conectar con el servidor', null, null, null),
    )
    const wrapper = await mountView()
    expect(wrapper.find('[role=alert]').text()).toContain('No se pudo conectar con el servidor')

    vi.mocked(api.listTransfers).mockResolvedValue(pageOf([transfer('t1')]))
    await wrapper.find('[role=alert] button').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
  })

  it('el filtro por estado y por bodega vuelve a pedir el listado con ese filtro', async () => {
    vi.mocked(api.listTransfers).mockResolvedValue(pageOf([transfer('t1')]))
    const wrapper = await mountView()

    await wrapper.find('select[name=status]').setValue('IN_TRANSIT')
    await flushPromises()
    await wrapper.find('select[name=warehouse]').setValue('wb')
    await flushPromises()

    expect(api.listTransfers).toHaveBeenLastCalledWith(
      { status: 'IN_TRANSIT', warehouseId: 'wb' },
      1,
      10,
    )
  })

  it('para el filtro solo pide bodegas, no productos', async () => {
    vi.mocked(api.listTransfers).mockResolvedValue(pageOf([]))
    const wrapper = await mountView()

    const options = wrapper.findAll('select[name=warehouse] option').map((o) => o.text())
    expect(options).toEqual(['Todas', 'A · Bodega A', 'B · Bodega B'])
    expect(productsApi.listProducts).not.toHaveBeenCalled()
  })

  it('pagina con Siguiente', async () => {
    vi.mocked(api.listTransfers).mockResolvedValue(pageOf([transfer('t1')], 1, 25))
    const wrapper = await mountView()

    await wrapper.findAll('.pager button')[1]?.trigger('click')
    await flushPromises()

    expect(api.listTransfers).toHaveBeenLastCalledWith({ status: '', warehouseId: '' }, 2, 10)
  })

  it.each([
    ['WAREHOUSE_MANAGER', true],
    ['OPERATOR', true],
    ['ADMIN', false],
    ['AUDITOR', false],
  ] as const)('%s ve el botón "Nuevo traspaso": %s', async (role, visible) => {
    vi.mocked(api.listTransfers).mockResolvedValue(pageOf([]))
    const wrapper = await mountView(role)
    expect(wrapper.text().includes('Nuevo traspaso')).toBe(visible)
  })
})
