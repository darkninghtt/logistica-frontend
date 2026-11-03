import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import * as reportsApi from '@/api/reports'
import * as warehousesApi from '@/api/warehouses'
import * as productsApi from '@/api/products'
import { ApiError } from '@/api/http'
import KardexView from './KardexView.vue'
import { piniaSignedInAs } from '@/testing'
import type { KardexPage, KardexRow } from '@/types/report'

vi.mock('@/api/reports')
vi.mock('@/api/warehouses')
vi.mock('@/api/products')

const WAREHOUSE = { id: 'w-1', code: 'A', name: 'Bodega A', active: true, createdAt: '' }
const PRODUCT = { id: 'p-1', sku: 'SKU-1', name: 'Tornillo', unit: 'un', createdAt: '' }
const TRANSFER = '44444444-4444-4444-8444-444444444444'

function row(overrides: Partial<KardexRow>): KardexRow {
  return {
    id: '1',
    createdAt: '2026-11-01T10:00:00.000Z',
    type: 'ENTRY',
    reference: null,
    transferId: null,
    quantity: 10,
    quantityIn: 10,
    quantityOut: 0,
    balanceQty: 10,
    unitCost: '100.0000',
    balanceAvgCost: '100.0000',
    balanceValue: '1000.0000',
    ...overrides,
  }
}

function page(data: KardexRow[], nextCursor: string | null = null): KardexPage {
  return {
    data,
    nextCursor,
    warehouse: { id: 'w-1', code: 'A', name: 'Bodega A' },
    product: { id: 'p-1', sku: 'SKU-1', name: 'Tornillo', unit: 'un' },
  }
}

function listOf<T>(data: T[]) {
  return { data, page: 1, pageSize: 100, total: data.length }
}

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: KardexView },
      { path: '/traspasos/:id', component: KardexView },
    ],
  })
  const wrapper = mount(KardexView, {
    global: { plugins: [piniaSignedInAs('AUDITOR'), router] },
  })
  await flushPromises()
  return wrapper
}

async function choose(wrapper: Awaited<ReturnType<typeof mountView>>) {
  await wrapper.find('select[name=warehouse]').setValue('w-1')
  await wrapper.find('select[name=product]').setValue('p-1')
  await flushPromises()
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(warehousesApi.listWarehouses).mockResolvedValue(listOf([WAREHOUSE]))
  vi.mocked(productsApi.listProducts).mockResolvedValue(listOf([PRODUCT]))
  vi.mocked(reportsApi.getKardex).mockResolvedValue(page([row({})]))
})

describe('KardexView', () => {
  it('pide elegir bodega y producto antes de consultar', async () => {
    const wrapper = await mountView()

    expect(wrapper.find('[data-test=kardex-hint]').exists()).toBe(true)
    await wrapper.find('select[name=warehouse]').setValue('w-1')
    await flushPromises()
    expect(reportsApi.getKardex).not.toHaveBeenCalled()
  })

  it('muestra las filas con entrada, salida, saldo, CPP y valor', async () => {
    vi.mocked(reportsApi.getKardex).mockResolvedValue(
      page([
        row({}),
        row({
          id: '2',
          type: 'TRANSFER_OUT',
          reference: TRANSFER,
          transferId: TRANSFER,
          quantity: 4,
          quantityIn: 0,
          quantityOut: 4,
          balanceQty: 6,
          balanceValue: '600.0000',
        }),
        row({
          id: '3',
          type: 'TRANSIT_SHRINKAGE',
          reference: 'Se cayó una caja',
          transferId: TRANSFER,
          quantity: 1,
          quantityIn: 0,
          quantityOut: 0,
          balanceQty: 6,
          balanceValue: '600.0000',
        }),
      ]),
    )
    const wrapper = await mountView()
    await choose(wrapper)

    expect(reportsApi.getKardex).toHaveBeenCalledWith('w-1', 'p-1', 20)
    expect(wrapper.find('[data-test=kardex-title]').text()).toContain('SKU-1 · Tornillo')
    const cells = wrapper
      .findAll('[data-test=kardex-table] tbody tr')
      .map((tr) => tr.findAll('td').map((td) => td.text().replace(/\s+/g, ' ')))
    expect(cells[0]?.slice(1)).toEqual([
      'Entrada',
      '',
      '10',
      '',
      '10',
      '100.0000',
      '100.0000',
      '1000.0000',
    ])
    expect(cells[1]?.slice(1, 6)).toEqual(['Salida por traspaso', 'Ver traspaso', '', '4', '6'])
    // La merma en tránsito no es entrada ni salida: su cantidad va en la referencia
    expect(cells[2]?.slice(1, 6)).toEqual([
      'Merma en tránsito',
      '1 perdidas en tránsito · Se cayó una caja Ver traspaso',
      '',
      '',
      '6',
    ])
    expect(wrapper.find('a[href="/traspasos/' + TRANSFER + '"]').exists()).toBe(true)
  })

  it('muestra el estado vacío', async () => {
    vi.mocked(reportsApi.getKardex).mockResolvedValue(page([]))
    const wrapper = await mountView()
    await choose(wrapper)

    expect(wrapper.find('[data-test=kardex-empty]').text()).toContain('no tiene movimientos')
  })

  it('muestra el error y permite reintentar', async () => {
    vi.mocked(reportsApi.getKardex)
      .mockRejectedValueOnce(new ApiError('No tienes acceso a esa bodega', 403, 'FORBIDDEN', 'x'))
      .mockResolvedValueOnce(page([row({})]))
    const wrapper = await mountView()
    await choose(wrapper)

    expect(wrapper.find('[data-test=kardex-error]').text()).toContain('No tienes acceso')
    await wrapper.find('[data-test=kardex-error] button').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test=kardex-table]').exists()).toBe(true)
  })

  it('"Cargar más" agrega la página siguiente hasta el final', async () => {
    vi.mocked(reportsApi.getKardex)
      .mockResolvedValueOnce(page([row({})], 'c-1'))
      .mockResolvedValueOnce(page([row({ id: '2' })], null))
    const wrapper = await mountView()
    await choose(wrapper)

    await wrapper.find('[data-test=load-more]').trigger('click')
    await flushPromises()

    expect(reportsApi.getKardex).toHaveBeenLastCalledWith('w-1', 'p-1', 20, 'c-1')
    expect(wrapper.findAll('[data-test=kardex-table] tbody tr')).toHaveLength(2)
    expect(wrapper.find('[data-test=kardex-end]').exists()).toBe(true)
  })

  it('muestra el error de las opciones y permite reintentar', async () => {
    vi.mocked(warehousesApi.listWarehouses)
      .mockRejectedValueOnce(new ApiError('Sin conexión', null, null, null))
      .mockResolvedValueOnce(listOf([WAREHOUSE]))
    const wrapper = await mountView()

    expect(wrapper.find('[data-test=options-error]').text()).toContain('Sin conexión')
    await wrapper.find('[data-test=options-error] button').trigger('click')
    await flushPromises()

    expect(wrapper.find('select[name=warehouse]').exists()).toBe(true)
  })
})
