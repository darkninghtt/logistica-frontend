import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import * as reportsApi from '@/api/reports'
import * as warehousesApi from '@/api/warehouses'
import * as productsApi from '@/api/products'
import { ApiError } from '@/api/http'
import ReportsView from './ReportsView.vue'
import { piniaSignedInAs } from '@/testing'
import type { InTransitReport, ShrinkageReport } from '@/types/report'

vi.mock('@/api/reports')
vi.mock('@/api/warehouses')
vi.mock('@/api/products')

const WAREHOUSE = { id: 'w-1', code: 'A', name: 'Bodega A', active: true, createdAt: '' }
const SHRINKAGE: ShrinkageReport = {
  data: [
    {
      warehouseId: 'w-1',
      warehouseCode: 'A',
      warehouseName: 'Bodega A',
      productId: 'p-1',
      productSku: 'SKU-1',
      productName: 'Tornillo',
      type: 'SHRINKAGE',
      reason: 'DAMAGE',
      quantity: 3,
      value: '312.3528',
    },
    {
      warehouseId: 'w-1',
      warehouseCode: 'A',
      warehouseName: 'Bodega A',
      productId: 'p-1',
      productSku: 'SKU-1',
      productName: 'Tornillo',
      type: 'TRANSIT_SHRINKAGE',
      reason: null,
      quantity: 1,
      value: '90.0000',
    },
  ],
  totals: { quantity: 4, value: '402.3528' },
}
const IN_TRANSIT: InTransitReport = {
  data: [
    {
      transferId: 't-1',
      originWarehouseId: 'w-1',
      originCode: 'A',
      originName: 'Bodega A',
      destinationWarehouseId: 'w-2',
      destinationCode: 'B',
      destinationName: 'Bodega B',
      dispatchedAt: '2026-11-01T15:00:00.000Z',
      daysInTransit: 2,
      quantity: 2,
      value: '208.2352',
    },
  ],
  totals: { transfers: 1, quantity: 2, value: '208.2352' },
}
const EMPTY_FILTERS = { warehouseId: '', from: '', to: '' }

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: ReportsView },
      { path: '/traspasos/:id', component: ReportsView },
    ],
  })
  const wrapper = mount(ReportsView, {
    global: { plugins: [piniaSignedInAs('WAREHOUSE_MANAGER'), router] },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(warehousesApi.listWarehouses).mockResolvedValue({
    data: [WAREHOUSE],
    page: 1,
    pageSize: 100,
    total: 1,
  })
  vi.mocked(productsApi.listProducts).mockResolvedValue({
    data: [],
    page: 1,
    pageSize: 100,
    total: 0,
  })
  vi.mocked(reportsApi.getShrinkageReport).mockResolvedValue(SHRINKAGE)
  vi.mocked(reportsApi.getInTransitReport).mockResolvedValue(IN_TRANSIT)
})

describe('ReportsView', () => {
  it('al entrar consulta los dos reportes sin filtros y los muestra con sus totales', async () => {
    const wrapper = await mountView()

    expect(reportsApi.getShrinkageReport).toHaveBeenCalledWith(EMPTY_FILTERS)
    expect(reportsApi.getInTransitReport).toHaveBeenCalledWith('')
    const rows = wrapper
      .findAll('[data-test=shrinkage-table] tbody tr')
      .map((tr) => tr.findAll('td').map((td) => td.text()))
    expect(rows).toEqual([
      ['A · Bodega A', 'SKU-1 · Tornillo', 'Merma', 'Daño', '3', '312.3528'],
      ['A · Bodega A', 'SKU-1 · Tornillo', 'Merma en tránsito', '', '1', '90.0000'],
    ])
    expect(wrapper.find('[data-test=shrinkage-totals]').text()).toContain('402.3528')
    expect(wrapper.find('[data-test=in-transit-table]').text()).toContain('B · Bodega B')
    expect(wrapper.find('[data-test=in-transit-totals]').text()).toContain('1 traspasos')
    expect(wrapper.find('a[href="/traspasos/t-1"]').exists()).toBe(true)
  })

  it('consultar con filtros envía la bodega y las fechas', async () => {
    const wrapper = await mountView()

    await wrapper.find('select[name=warehouse]').setValue('w-1')
    await wrapper.find('input[name=from]').setValue('2026-11-01')
    await wrapper.find('input[name=to]').setValue('2026-11-03')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(reportsApi.getShrinkageReport).toHaveBeenLastCalledWith({
      warehouseId: 'w-1',
      from: '2026-11-01',
      to: '2026-11-03',
    })
    expect(reportsApi.getInTransitReport).toHaveBeenLastCalledWith('w-1')
  })

  it('muestra los estados vacíos', async () => {
    vi.mocked(reportsApi.getShrinkageReport).mockResolvedValue({
      data: [],
      totals: { quantity: 0, value: '0.0000' },
    })
    vi.mocked(reportsApi.getInTransitReport).mockResolvedValue({
      data: [],
      totals: { transfers: 0, quantity: 0, value: '0.0000' },
    })
    const wrapper = await mountView()

    expect(wrapper.find('[data-test=shrinkage-empty]').exists()).toBe(true)
    expect(wrapper.find('[data-test=in-transit-empty]').exists()).toBe(true)
  })

  it('muestra el error de cada reporte por separado y permite reintentar', async () => {
    vi.mocked(reportsApi.getShrinkageReport)
      .mockRejectedValueOnce(new ApiError('Error interno del servidor', 500, 'INTERNAL_ERROR', 'x'))
      .mockResolvedValueOnce(SHRINKAGE)
    const wrapper = await mountView()

    expect(wrapper.find('[data-test=shrinkage-error]').text()).toContain('Error interno')
    expect(wrapper.find('[data-test=in-transit-table]').exists()).toBe(true)
    await wrapper.find('[data-test=shrinkage-error] button').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test=shrinkage-table]').exists()).toBe(true)
  })
})
