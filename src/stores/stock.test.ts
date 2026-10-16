import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import * as stockApi from '@/api/stock'
import * as warehousesApi from '@/api/warehouses'
import * as productsApi from '@/api/products'
import { ApiError } from '@/api/http'
import { useStockStore } from './stock'
import type { StockLevelItem, StockMovementItem } from '@/types/stock'

vi.mock('@/api/stock')
vi.mock('@/api/warehouses')
vi.mock('@/api/products')

function level(sku: string, quantity = 10): StockLevelItem {
  return {
    productId: `p-${sku}`,
    warehouseId: 'w-1',
    quantity,
    avgCost: '110.0000',
    totalValue: '1100.0000',
    productSku: sku,
    productName: `Producto ${sku}`,
    productUnit: 'un',
  }
}

function movement(id: string, sku = 'A'): StockMovementItem {
  return {
    id,
    productId: `p-${sku}`,
    warehouseId: 'w-1',
    type: 'ENTRY',
    quantity: 10,
    unitCost: '120.0000',
    balanceQty: 20,
    balanceAvgCost: '110.0000',
    createdBy: 'u-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    productSku: sku,
    productName: `Producto ${sku}`,
  }
}

function pageOf<T>(data: T[], page = 1, total = data.length) {
  return { data, page, pageSize: 10, total }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

describe('store stock', () => {
  it('empieza en idle, sin bodega elegida', () => {
    const store = useStockStore()
    expect(store.warehouseId).toBe('')
    expect(store.levelsStatus).toBe('idle')
    expect(store.movementsStatus).toBe('idle')
  })

  it('loadOptions carga las bodegas y los productos para los selectores', async () => {
    vi.mocked(warehousesApi.listWarehouses).mockResolvedValue(
      pageOf([{ id: 'w-1', code: 'A', name: 'Bodega A', active: true, createdAt: '' }]),
    )
    vi.mocked(productsApi.listProducts).mockResolvedValue(
      pageOf([{ id: 'p-A', sku: 'A', name: 'Tornillo', unit: 'un', createdAt: '' }]),
    )
    const store = useStockStore()

    await store.loadOptions()

    expect(warehousesApi.listWarehouses).toHaveBeenCalledWith(1, 100)
    expect(store.optionsStatus).toBe('success')
    expect(store.warehouses).toHaveLength(1)
    expect(store.products).toHaveLength(1)
  })

  it('loadOptions deja el error si falla', async () => {
    vi.mocked(warehousesApi.listWarehouses).mockRejectedValue(
      new ApiError('No se pudo conectar con el servidor', null, null, null),
    )
    vi.mocked(productsApi.listProducts).mockResolvedValue(pageOf([]))
    const store = useStockStore()

    await store.loadOptions()

    expect(store.optionsStatus).toBe('error')
    expect(store.optionsError).toBe('No se pudo conectar con el servidor')
  })

  it('selectWarehouse carga existencias e historial de esa bodega', async () => {
    vi.mocked(stockApi.listStockLevels).mockResolvedValue(pageOf([level('A', 20)], 1, 11))
    vi.mocked(stockApi.listStockMovements).mockResolvedValue(
      pageOf([movement('2'), movement('1')], 1, 2),
    )
    const store = useStockStore()

    await store.selectWarehouse('w-1')

    expect(stockApi.listStockLevels).toHaveBeenCalledWith('w-1', 1, 10)
    expect(stockApi.listStockMovements).toHaveBeenCalledWith('w-1', undefined, 1, 10)
    expect(store.levelsStatus).toBe('success')
    expect(store.levels.map((l) => l.productSku)).toEqual(['A'])
    expect(store.levelsPages).toBe(2)
    expect(store.movements.map((m) => m.id)).toEqual(['2', '1'])
    expect(store.movementsTotal).toBe(2)
  })

  it('selectProduct filtra el historial y vuelve a la página 1', async () => {
    vi.mocked(stockApi.listStockLevels).mockResolvedValue(pageOf([]))
    vi.mocked(stockApi.listStockMovements).mockResolvedValue(pageOf([movement('1')]))
    const store = useStockStore()
    await store.selectWarehouse('w-1')

    await store.selectProduct('p-A')

    expect(stockApi.listStockMovements).toHaveBeenLastCalledWith('w-1', 'p-A', 1, 10)
  })

  it('al cambiar de bodega se reinicia el filtro de producto', async () => {
    vi.mocked(stockApi.listStockLevels).mockResolvedValue(pageOf([]))
    vi.mocked(stockApi.listStockMovements).mockResolvedValue(pageOf([]))
    const store = useStockStore()
    await store.selectWarehouse('w-1')
    await store.selectProduct('p-A')

    await store.selectWarehouse('w-2')

    expect(store.productId).toBe('')
    expect(stockApi.listStockMovements).toHaveBeenLastCalledWith('w-2', undefined, 1, 10)
  })

  it('deseleccionar la bodega vacía las listas y no consulta la API', async () => {
    vi.mocked(stockApi.listStockLevels).mockResolvedValue(pageOf([level('A')]))
    vi.mocked(stockApi.listStockMovements).mockResolvedValue(pageOf([movement('1')]))
    const store = useStockStore()
    await store.selectWarehouse('w-1')
    vi.mocked(stockApi.listStockLevels).mockClear()

    await store.selectWarehouse('')

    expect(store.levels).toEqual([])
    expect(store.movements).toEqual([])
    expect(store.levelsStatus).toBe('idle')
    expect(stockApi.listStockLevels).not.toHaveBeenCalled()
  })

  it('un error en las existencias no impide mostrar el historial', async () => {
    vi.mocked(stockApi.listStockLevels).mockRejectedValue(
      new ApiError('La bodega no existe', 404, 'NOT_FOUND', 'x'),
    )
    vi.mocked(stockApi.listStockMovements).mockResolvedValue(pageOf([movement('1')]))
    const store = useStockStore()

    await store.selectWarehouse('w-1')

    expect(store.levelsStatus).toBe('error')
    expect(store.levelsError).toBe('La bodega no existe')
    expect(store.movementsStatus).toBe('success')
  })

  it('un error en el historial deja su propio estado de error', async () => {
    vi.mocked(stockApi.listStockLevels).mockResolvedValue(pageOf([level('A')]))
    vi.mocked(stockApi.listStockMovements).mockRejectedValue(
      new ApiError('Error interno del servidor', 500, 'INTERNAL_ERROR', 'x'),
    )
    const store = useStockStore()

    await store.selectWarehouse('w-1')

    expect(store.movementsStatus).toBe('error')
    expect(store.movementsError).toBe('Error interno del servidor')
    expect(store.levelsStatus).toBe('success')
  })

  it('fetchMovements pide la página indicada', async () => {
    vi.mocked(stockApi.listStockLevels).mockResolvedValue(pageOf([]))
    vi.mocked(stockApi.listStockMovements).mockResolvedValue(pageOf([movement('1')], 2, 11))
    const store = useStockStore()
    await store.selectWarehouse('w-1')

    await store.fetchMovements(2)

    expect(stockApi.listStockMovements).toHaveBeenLastCalledWith('w-1', undefined, 2, 10)
    expect(store.movementsPage).toBe(2)
  })

  it('ignora la respuesta de una bodega anterior si ya se cambió de bodega', async () => {
    let resolveFirst: (value: ReturnType<typeof pageOf<StockLevelItem>>) => void = () => undefined
    vi.mocked(stockApi.listStockLevels)
      .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce(pageOf([level('B')]))
    vi.mocked(stockApi.listStockMovements).mockResolvedValue(pageOf([]))
    const store = useStockStore()

    const first = store.selectWarehouse('w-1')
    await store.selectWarehouse('w-2')
    resolveFirst(pageOf([level('A')]))
    await first

    expect(store.levels.map((l) => l.productSku)).toEqual(['B'])
  })
})
