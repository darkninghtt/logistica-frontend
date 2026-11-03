import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import * as reportsApi from '@/api/reports'
import { ApiError } from '@/api/http'
import { useReportsStore } from './reports'
import type { KardexPage, KardexRow } from '@/types/report'

vi.mock('@/api/reports')

function row(id: string): KardexRow {
  return {
    id,
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
  }
}

function page(ids: string[], nextCursor: string | null = null): KardexPage {
  return {
    data: ids.map(row),
    nextCursor,
    warehouse: { id: 'w-1', code: 'A', name: 'Bodega A' },
    product: { id: 'p-1', sku: 'SKU-1', name: 'Tornillo', unit: 'un' },
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

describe('store reports: kardex', () => {
  it('empieza en idle y sin filas', () => {
    const store = useReportsStore()
    expect(store.kardexStatus).toBe('idle')
    expect(store.kardex).toEqual([])
  })

  it('carga la primera página con la bodega y el producto', async () => {
    vi.mocked(reportsApi.getKardex).mockResolvedValue(page(['1', '2'], 'c-2'))
    const store = useReportsStore()

    await store.loadKardex('w-1', 'p-1')

    expect(reportsApi.getKardex).toHaveBeenCalledWith('w-1', 'p-1', 20)
    expect(store.kardexStatus).toBe('success')
    expect(store.kardex.map((r) => r.id)).toEqual(['1', '2'])
    expect(store.kardexProduct?.sku).toBe('SKU-1')
    expect(store.hasMoreKardex).toBe(true)
  })

  it('sin bodega o sin producto no consulta y vuelve a idle', async () => {
    const store = useReportsStore()

    await store.loadKardex('w-1', '')

    expect(reportsApi.getKardex).not.toHaveBeenCalled()
    expect(store.kardexStatus).toBe('idle')
  })

  it('"Cargar más" agrega la página siguiente en orden y se detiene al final', async () => {
    vi.mocked(reportsApi.getKardex)
      .mockResolvedValueOnce(page(['1', '2'], 'c-2'))
      .mockResolvedValueOnce(page(['3'], null))
    const store = useReportsStore()
    await store.loadKardex('w-1', 'p-1')

    await store.loadMoreKardex()
    await store.loadMoreKardex()

    expect(reportsApi.getKardex).toHaveBeenCalledTimes(2)
    expect(reportsApi.getKardex).toHaveBeenLastCalledWith('w-1', 'p-1', 20, 'c-2')
    expect(store.kardex.map((r) => r.id)).toEqual(['1', '2', '3'])
    expect(store.hasMoreKardex).toBe(false)
  })

  it('un error de la API (por ejemplo 403) queda en el estado de error', async () => {
    vi.mocked(reportsApi.getKardex).mockRejectedValue(
      new ApiError('No tienes acceso a esa bodega', 403, 'FORBIDDEN', 'x'),
    )
    const store = useReportsStore()

    await store.loadKardex('w-2', 'p-1')

    expect(store.kardexStatus).toBe('error')
    expect(store.kardexError).toBe('No tienes acceso a esa bodega')
  })

  it('si "Cargar más" falla conserva las filas y el cursor', async () => {
    vi.mocked(reportsApi.getKardex)
      .mockResolvedValueOnce(page(['1'], 'c-1'))
      .mockRejectedValueOnce(new ApiError('Sin conexión', null, null, null))
    const store = useReportsStore()
    await store.loadKardex('w-1', 'p-1')

    await store.loadMoreKardex()

    expect(store.moreKardexStatus).toBe('error')
    expect(store.kardex.map((r) => r.id)).toEqual(['1'])
    expect(store.hasMoreKardex).toBe(true)
  })

  it('descarta la respuesta de una selección anterior', async () => {
    let resolveFirst: (value: KardexPage) => void = () => undefined
    vi.mocked(reportsApi.getKardex)
      .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce(page(['9']))
    const store = useReportsStore()

    const first = store.loadKardex('w-1', 'p-1')
    await store.loadKardex('w-1', 'p-2')
    resolveFirst(page(['1']))
    await first

    expect(store.kardex.map((r) => r.id)).toEqual(['9'])
  })
})
