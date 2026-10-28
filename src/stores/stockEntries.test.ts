import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import * as productsApi from '@/api/products'
import * as stockApi from '@/api/stockEntries'
import * as warehousesApi from '@/api/warehouses'
import { ApiError } from '@/api/http'
import { useStockEntriesStore } from './stockEntries'
import { useStockStore } from './stock'
import { CACHE_TTL_MS } from '@/composables/useTtlCache'
import type { StockEntryInput, StockEntryResult } from '@/types/stockEntry'

vi.mock('@/api/products')
vi.mock('@/api/stockEntries')
vi.mock('@/api/warehouses')

const input: StockEntryInput = {
  warehouseId: 'w1',
  productId: 'p1',
  quantity: 10,
  unitCost: '100',
}

const result: StockEntryResult = {
  stockLevel: {
    productId: 'p1',
    warehouseId: 'w1',
    quantity: 10,
    avgCost: '100.0000',
    totalValue: '1000.0000',
  },
  movement: {
    id: '1',
    productId: 'p1',
    warehouseId: 'w1',
    type: 'ENTRY',
    quantity: 10,
    unitCost: '100.0000',
    balanceQty: 10,
    balanceAvgCost: '100.0000',
    reason: null,
    transferId: null,
    createdBy: 'u1',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

describe('store stockEntries', () => {
  it('empieza en idle, sin opciones ni resultado', () => {
    const store = useStockEntriesStore()
    expect(store.optionsStatus).toBe('idle')
    expect(store.warehouses).toEqual([])
    expect(store.lastEntry).toBeNull()
  })

  it('loadOptions carga bodegas y productos pasando por loading', async () => {
    vi.mocked(warehousesApi.listWarehouses).mockResolvedValue({
      data: [{ id: 'w1', code: 'A', name: 'Bodega A', active: true, createdAt: '' }],
      page: 1,
      pageSize: 100,
      total: 1,
    })
    vi.mocked(productsApi.listProducts).mockResolvedValue({
      data: [{ id: 'p1', sku: 'S1', name: 'Tornillo', unit: 'un', createdAt: '' }],
      page: 1,
      pageSize: 100,
      total: 1,
    })
    const store = useStockEntriesStore()

    const pending = store.loadOptions()
    expect(store.optionsStatus).toBe('loading')
    await pending

    expect(store.optionsStatus).toBe('success')
    expect(store.warehouses.map((w) => w.code)).toEqual(['A'])
    expect(store.products.map((p) => p.sku)).toEqual(['S1'])
    expect(warehousesApi.listWarehouses).toHaveBeenCalledWith(1, 100)
  })

  it('si falla la carga de opciones queda en error con el mensaje', async () => {
    vi.mocked(warehousesApi.listWarehouses).mockRejectedValue(
      new ApiError('No se pudo conectar con el servidor', null, null, null),
    )
    vi.mocked(productsApi.listProducts).mockResolvedValue({
      data: [],
      page: 1,
      pageSize: 100,
      total: 0,
    })
    const store = useStockEntriesStore()

    await store.loadOptions()

    expect(store.optionsStatus).toBe('error')
    expect(store.optionsError).toBe('No se pudo conectar con el servidor')
  })

  it('register guarda el resultado y devuelve true', async () => {
    vi.mocked(stockApi.createStockEntry).mockResolvedValue(result)
    const store = useStockEntriesStore()

    const pending = store.register(input)
    expect(store.saving).toBe(true)
    const ok = await pending

    expect(ok).toBe(true)
    expect(store.saving).toBe(false)
    expect(store.lastEntry?.stockLevel.avgCost).toBe('100.0000')
    expect(stockApi.createStockEntry).toHaveBeenCalledWith(input)
  })

  it('register devuelve false y deja el error de la API si falla', async () => {
    vi.mocked(stockApi.createStockEntry).mockRejectedValue(
      new ApiError('La bodega no existe', 404, 'NOT_FOUND', 'c1'),
    )
    const store = useStockEntriesStore()

    const ok = await store.register(input)

    expect(ok).toBe(false)
    expect(store.saving).toBe(false)
    expect(store.saveError).toBe('La bodega no existe')
    expect(store.lastEntry).toBeNull()
  })

  it('clearResult limpia el resultado y el error', async () => {
    vi.mocked(stockApi.createStockEntry).mockResolvedValue(result)
    const store = useStockEntriesStore()
    await store.register(input)

    store.clearResult()

    expect(store.lastEntry).toBeNull()
    expect(store.saveError).toBeNull()
  })
})

describe('caché con TTL de stockEntries', () => {
  const empty = { data: [], page: 1, pageSize: 100, total: 0 }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(warehousesApi.listWarehouses).mockResolvedValue(empty)
    vi.mocked(productsApi.listProducts).mockResolvedValue(empty)
  })
  afterEach(() => vi.useRealTimers())

  it('dos loadOptions seguidos piden una sola vez; con force o pasado el TTL, otra', async () => {
    const store = useStockEntriesStore()

    await store.loadOptions()
    await store.loadOptions()
    expect(warehousesApi.listWarehouses).toHaveBeenCalledTimes(1)
    expect(store.optionsFetchedAt).not.toBeNull()

    await store.loadOptions({ force: true })
    expect(warehousesApi.listWarehouses).toHaveBeenCalledTimes(2)

    vi.advanceTimersByTime(CACHE_TTL_MS)
    await store.loadOptions()
    expect(warehousesApi.listWarehouses).toHaveBeenCalledTimes(3)
  })

  it('invalidateOptions hace que la próxima carga vaya al servidor', async () => {
    const store = useStockEntriesStore()
    await store.loadOptions()

    store.invalidateOptions()
    await store.loadOptions()

    expect(warehousesApi.listWarehouses).toHaveBeenCalledTimes(2)
  })

  it('registrar una entrada invalida el stock; si falla, no', async () => {
    const invalidateStock = vi.spyOn(useStockStore(), 'invalidate')
    const store = useStockEntriesStore()

    vi.mocked(stockApi.createStockEntry).mockRejectedValueOnce(
      new ApiError('La bodega no existe', 404, null, null),
    )
    await store.register(input)
    expect(invalidateStock).not.toHaveBeenCalled()

    vi.mocked(stockApi.createStockEntry).mockResolvedValueOnce(result)
    await store.register(input)
    expect(invalidateStock).toHaveBeenCalledTimes(1)
  })
})
