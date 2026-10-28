import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import * as productsApi from '@/api/products'
import * as shrinkageApi from '@/api/stockShrinkages'
import * as warehousesApi from '@/api/warehouses'
import { ApiError } from '@/api/http'
import { useStockShrinkagesStore } from './stockShrinkages'
import { useStockStore } from './stock'
import { CACHE_TTL_MS } from '@/composables/useTtlCache'
import type { StockShrinkageInput, StockShrinkageResult } from '@/types/stockShrinkage'

vi.mock('@/api/products')
vi.mock('@/api/stockShrinkages')
vi.mock('@/api/warehouses')

const input: StockShrinkageInput = {
  warehouseId: 'w1',
  productId: 'p1',
  quantity: 2,
  reason: 'DAMAGE',
}

const result: StockShrinkageResult = {
  stockLevel: {
    productId: 'p1',
    warehouseId: 'w1',
    quantity: 10,
    avgCost: '110.0000',
    totalValue: '1100.0000',
  },
  movement: {
    id: '7',
    productId: 'p1',
    warehouseId: 'w1',
    type: 'SHRINKAGE',
    quantity: 2,
    unitCost: '110.0000',
    balanceQty: 10,
    balanceAvgCost: '110.0000',
    reason: 'DAMAGE',
    transferId: null,
    createdBy: 'u1',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
}

const empty = { data: [], page: 1, pageSize: 100, total: 0 }

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

describe('store stockShrinkages', () => {
  it('empieza en idle, sin opciones ni resultado', () => {
    const store = useStockShrinkagesStore()
    expect(store.optionsStatus).toBe('idle')
    expect(store.warehouses).toEqual([])
    expect(store.lastShrinkage).toBeNull()
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
    const store = useStockShrinkagesStore()

    const pending = store.loadOptions()
    expect(store.optionsStatus).toBe('loading')
    await pending

    expect(store.optionsStatus).toBe('success')
    expect(store.warehouses.map((w) => w.code)).toEqual(['A'])
    expect(store.products.map((p) => p.sku)).toEqual(['S1'])
  })

  it('si falla la carga de opciones queda en error con el mensaje', async () => {
    vi.mocked(warehousesApi.listWarehouses).mockRejectedValue(
      new ApiError('No se pudo conectar con el servidor', null, null, null),
    )
    vi.mocked(productsApi.listProducts).mockResolvedValue(empty)
    const store = useStockShrinkagesStore()

    await store.loadOptions()

    expect(store.optionsStatus).toBe('error')
    expect(store.optionsError).toBe('No se pudo conectar con el servidor')
  })

  it('register guarda el resultado, invalida el stock y devuelve true', async () => {
    vi.mocked(shrinkageApi.createStockShrinkage).mockResolvedValue(result)
    const invalidateStock = vi.spyOn(useStockStore(), 'invalidate')
    const store = useStockShrinkagesStore()

    const pending = store.register(input)
    expect(store.saving).toBe(true)
    const ok = await pending

    expect(ok).toBe(true)
    expect(store.saving).toBe(false)
    expect(store.lastShrinkage?.stockLevel.quantity).toBe(10)
    expect(shrinkageApi.createStockShrinkage).toHaveBeenCalledWith(input)
    expect(invalidateStock).toHaveBeenCalledTimes(1)
  })

  it('con stock insuficiente devuelve false, deja el error y no invalida el stock', async () => {
    vi.mocked(shrinkageApi.createStockShrinkage).mockRejectedValue(
      new ApiError(
        'No hay stock suficiente en la bodega para registrar la merma',
        409,
        'INSUFFICIENT_STOCK',
        'c1',
      ),
    )
    const invalidateStock = vi.spyOn(useStockStore(), 'invalidate')
    const store = useStockShrinkagesStore()

    const ok = await store.register(input)

    expect(ok).toBe(false)
    expect(store.saving).toBe(false)
    expect(store.saveError).toBe('No hay stock suficiente en la bodega para registrar la merma')
    expect(store.lastShrinkage).toBeNull()
    expect(invalidateStock).not.toHaveBeenCalled()
  })

  it('clearResult limpia el resultado y el error', async () => {
    vi.mocked(shrinkageApi.createStockShrinkage).mockResolvedValue(result)
    const store = useStockShrinkagesStore()
    await store.register(input)

    store.clearResult()

    expect(store.lastShrinkage).toBeNull()
    expect(store.saveError).toBeNull()
  })
})

describe('caché con TTL de stockShrinkages', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(warehousesApi.listWarehouses).mockResolvedValue(empty)
    vi.mocked(productsApi.listProducts).mockResolvedValue(empty)
  })
  afterEach(() => vi.useRealTimers())

  it('dos loadOptions seguidos piden una sola vez; con force, invalidando o pasado el TTL, otra', async () => {
    const store = useStockShrinkagesStore()

    await store.loadOptions()
    await store.loadOptions()
    expect(warehousesApi.listWarehouses).toHaveBeenCalledTimes(1)

    await store.loadOptions({ force: true })
    expect(warehousesApi.listWarehouses).toHaveBeenCalledTimes(2)

    store.invalidateOptions()
    await store.loadOptions()
    expect(warehousesApi.listWarehouses).toHaveBeenCalledTimes(3)

    vi.advanceTimersByTime(CACHE_TTL_MS)
    await store.loadOptions()
    expect(warehousesApi.listWarehouses).toHaveBeenCalledTimes(4)
  })
})
