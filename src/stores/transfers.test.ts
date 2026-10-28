import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import * as productsApi from '@/api/products'
import * as api from '@/api/transfers'
import * as warehousesApi from '@/api/warehouses'
import { ApiError } from '@/api/http'
import { CACHE_TTL_MS } from '@/composables/useTtlCache'
import { useProductsStore } from './products'
import { useStockStore } from './stock'
import { useTransfersStore } from './transfers'
import { useWarehousesStore } from './warehouses'
import type { TransferDetail, TransferSummary, WarehouseRef } from '@/types/transfer'

vi.mock('@/api/products')
vi.mock('@/api/transfers')
vi.mock('@/api/warehouses')

const A: WarehouseRef = { id: 'wa', code: 'A', name: 'Bodega A' }
const B: WarehouseRef = { id: 'wb', code: 'B', name: 'Bodega B' }

function summary(id: string, status: TransferSummary['status'] = 'DRAFT'): TransferSummary {
  return {
    id,
    status,
    origin: A,
    destination: B,
    itemCount: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function detail(id: string, status: TransferDetail['status'] = 'DRAFT'): TransferDetail {
  return {
    id,
    status,
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
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    items: [
      {
        productId: 'p1',
        productSku: 'S1',
        productName: 'Tornillo',
        quantitySent: 8,
        quantityReceived: null,
        unitCost: null,
      },
    ],
    events: [],
  }
}

function pageOf(ids: string[], page = 1, total = ids.length) {
  return { data: ids.map((id) => summary(id)), page, pageSize: 10, total }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

describe('store transfers: listado', () => {
  it('empieza en idle y vacío', () => {
    const store = useTransfersStore()
    expect(store.status).toBe('idle')
    expect(store.items).toEqual([])
    expect(store.filters).toEqual({ status: '', warehouseId: '' })
  })

  it('fetchPage pasa por loading y deja los datos normalizados (byId + ids)', async () => {
    vi.mocked(api.listTransfers).mockResolvedValue(pageOf(['t1', 't2'], 1, 12))
    const store = useTransfersStore()

    const pending = store.fetchPage()
    expect(store.status).toBe('loading')
    await pending

    expect(store.status).toBe('success')
    expect(store.ids).toEqual(['t1', 't2'])
    expect(store.byId['t1']?.origin.code).toBe('A')
    expect(store.items.map((t) => t.id)).toEqual(['t1', 't2'])
    expect(store.total).toBe(12)
    expect(store.totalPages).toBe(2)
    expect(api.listTransfers).toHaveBeenCalledWith({ status: '', warehouseId: '' }, 1, 10)
  })

  it('si la carga falla queda en error con el mensaje', async () => {
    vi.mocked(api.listTransfers).mockRejectedValue(new ApiError('Sin permiso', 403, null, null))
    const store = useTransfersStore()

    await store.fetchPage()

    expect(store.status).toBe('error')
    expect(store.error).toBe('Sin permiso')
  })

  it('setFilters pide la primera página con los filtros nuevos', async () => {
    vi.mocked(api.listTransfers).mockResolvedValue(pageOf(['t1']))
    const store = useTransfersStore()
    await store.fetchPage(3)

    await store.setFilters({ status: 'IN_TRANSIT' })

    expect(api.listTransfers).toHaveBeenLastCalledWith(
      { status: 'IN_TRANSIT', warehouseId: '' },
      1,
      10,
    )
    expect(store.filters.status).toBe('IN_TRANSIT')
  })

  it('ignora la respuesta de una consulta vieja si ya se pidió otra', async () => {
    let resolveFirst: (value: ReturnType<typeof pageOf>) => void = () => undefined
    vi.mocked(api.listTransfers)
      .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce(pageOf(['nuevo']))
    const store = useTransfersStore()

    const first = store.fetchPage(1)
    await store.setFilters({ status: 'DRAFT' })
    resolveFirst(pageOf(['viejo']))
    await first

    expect(store.ids).toEqual(['nuevo'])
  })
})

describe('store transfers: detalle', () => {
  it('fetchDetail guarda el detalle por id', async () => {
    vi.mocked(api.getTransfer).mockResolvedValue(detail('t1'))
    const store = useTransfersStore()

    const pending = store.fetchDetail('t1')
    expect(store.detailStatus).toBe('loading')
    await pending

    expect(store.detailStatus).toBe('success')
    expect(store.details['t1']?.status).toBe('DRAFT')
  })

  it('si falla queda en error y conserva el detalle anterior', async () => {
    vi.mocked(api.getTransfer).mockResolvedValueOnce(detail('t1'))
    const store = useTransfersStore()
    await store.fetchDetail('t1')

    vi.mocked(api.getTransfer).mockRejectedValue(new ApiError('Caído', 503, null, null))
    await store.fetchDetail('t1', { force: true })

    expect(store.detailStatus).toBe('error')
    expect(store.detailError).toBe('Caído')
    expect(store.details['t1']).toBeDefined()
  })
})

describe('store transfers: crear', () => {
  const input = {
    originWarehouseId: 'wa',
    destinationWarehouseId: 'wb',
    items: [{ productId: 'p1', quantity: 8 }],
  }

  it('devuelve el id, guarda el detalle e invalida el listado', async () => {
    vi.mocked(api.createTransfer).mockResolvedValue(detail('t9'))
    vi.mocked(api.listTransfers).mockResolvedValue(pageOf(['t1']))
    const store = useTransfersStore()
    await store.fetchPage()

    const id = await store.create(input)

    expect(id).toBe('t9')
    expect(api.createTransfer).toHaveBeenCalledWith(input)
    expect(store.details['t9']).toBeDefined()
    expect(store.lastFetchedAt).toBeNull()
    expect(store.saving).toBe(false)
  })

  it('si falla devuelve null y deja saveError', async () => {
    vi.mocked(api.createTransfer).mockRejectedValue(
      new ApiError('Algún producto del traspaso no existe', 404, 'NOT_FOUND', 'c1'),
    )
    const store = useTransfersStore()

    expect(await store.create(input)).toBeNull()
    expect(store.saveError).toBe('Algún producto del traspaso no existe')
    expect(store.saving).toBe(false)

    store.clearSaveError()
    expect(store.saveError).toBeNull()
  })

  it('un segundo envío mientras guarda no manda otra petición', async () => {
    let finish: (value: TransferDetail) => void = () => undefined
    vi.mocked(api.createTransfer).mockReturnValue(new Promise((resolve) => (finish = resolve)))
    const store = useTransfersStore()

    const first = store.create(input)
    const second = await store.create(input)
    finish(detail('t1'))
    await first

    expect(second).toBeNull()
    expect(api.createTransfer).toHaveBeenCalledTimes(1)
  })
})

describe('store transfers: despachar y cancelar', () => {
  it('dispatch actualiza el detalle y la fila del listado, e invalida listado y stock', async () => {
    vi.mocked(api.listTransfers).mockResolvedValue(pageOf(['t1']))
    vi.mocked(api.dispatchTransfer).mockResolvedValue(detail('t1', 'IN_TRANSIT'))
    const store = useTransfersStore()
    const stock = useStockStore()
    const invalidateStock = vi.spyOn(stock, 'invalidate')
    await store.fetchPage()

    const ok = await store.dispatch('t1')

    expect(ok).toBe(true)
    expect(store.details['t1']?.status).toBe('IN_TRANSIT')
    expect(store.byId['t1']?.status).toBe('IN_TRANSIT')
    expect(store.lastFetchedAt).toBeNull()
    expect(invalidateStock).toHaveBeenCalledTimes(1)
    expect(store.acting).toBe(false)
  })

  it('cancel manda el motivo si lo hay', async () => {
    vi.mocked(api.cancelTransfer).mockResolvedValue(detail('t1', 'CANCELLED'))
    const store = useTransfersStore()

    expect(await store.cancel('t1', 'Ya no hace falta')).toBe(true)

    expect(api.cancelTransfer).toHaveBeenCalledWith('t1', 'Ya no hace falta')
    expect(store.details['t1']?.status).toBe('CANCELLED')
  })

  it('un segundo clic mientras la primera acción corre no manda otra petición', async () => {
    let finish: (value: TransferDetail) => void = () => undefined
    vi.mocked(api.dispatchTransfer).mockReturnValue(new Promise((resolve) => (finish = resolve)))
    const store = useTransfersStore()

    const first = store.dispatch('t1')
    expect(store.acting).toBe(true)
    const second = await store.dispatch('t1')
    finish(detail('t1', 'IN_TRANSIT'))
    await first

    expect(second).toBe(false)
    expect(api.dispatchTransfer).toHaveBeenCalledTimes(1)
  })

  it('ante un 409 deja el mensaje, recarga el traspaso y no invalida el stock', async () => {
    vi.mocked(api.dispatchTransfer).mockRejectedValue(
      new ApiError('El traspaso está en IN_TRANSIT', 409, 'INVALID_TRANSITION', 'c1'),
    )
    vi.mocked(api.getTransfer).mockResolvedValue(detail('t1', 'IN_TRANSIT'))
    const store = useTransfersStore()
    const invalidateStock = vi.spyOn(useStockStore(), 'invalidate')

    const ok = await store.dispatch('t1')

    expect(ok).toBe(false)
    expect(store.actionError).toBe('El traspaso está en IN_TRANSIT')
    expect(api.getTransfer).toHaveBeenCalledWith('t1')
    expect(store.details['t1']?.status).toBe('IN_TRANSIT')
    expect(invalidateStock).not.toHaveBeenCalled()
    expect(store.acting).toBe(false)
  })

  it('ante otro error deja el mensaje sin recargar', async () => {
    vi.mocked(api.dispatchTransfer).mockRejectedValue(
      new ApiError('No tienes permiso', 403, 'FORBIDDEN', 'c1'),
    )
    const store = useTransfersStore()

    expect(await store.dispatch('t1')).toBe(false)

    expect(store.actionError).toBe('No tienes permiso')
    expect(api.getTransfer).not.toHaveBeenCalled()
    store.clearActionError()
    expect(store.actionError).toBeNull()
  })
})

describe('store transfers: opciones del borrador', () => {
  it('el origen sale de las bodegas asignadas activas y el destino de todas', async () => {
    vi.mocked(warehousesApi.listWarehouses).mockResolvedValue({
      data: [
        { ...A, active: true, createdAt: '' },
        { id: 'wx', code: 'X', name: 'Bodega X', active: false, createdAt: '' },
      ],
      page: 1,
      pageSize: 100,
      total: 2,
    })
    vi.mocked(warehousesApi.listDestinations).mockResolvedValue([A, B])
    vi.mocked(productsApi.listProducts).mockResolvedValue({
      data: [{ id: 'p1', sku: 'S1', name: 'Tornillo', unit: 'un', createdAt: '' }],
      page: 1,
      pageSize: 100,
      total: 1,
    })
    const store = useTransfersStore()

    const pending = store.loadOptions()
    expect(store.optionsStatus).toBe('loading')
    await pending

    expect(store.optionsStatus).toBe('success')
    expect(store.origins).toEqual([A])
    expect(store.destinations).toEqual([A, B])
    expect(store.products.map((p) => p.id)).toEqual(['p1'])
  })

  it('si falla queda en error', async () => {
    vi.mocked(warehousesApi.listWarehouses).mockRejectedValue(
      new ApiError('Caído', 503, null, null),
    )
    vi.mocked(warehousesApi.listDestinations).mockResolvedValue([])
    vi.mocked(productsApi.listProducts).mockResolvedValue({
      data: [],
      page: 1,
      pageSize: 100,
      total: 0,
    })
    const store = useTransfersStore()

    await store.loadOptions()

    expect(store.optionsStatus).toBe('error')
    expect(store.optionsError).toBe('Caído')
  })

  it('crear una bodega o un producto descarta las opciones', async () => {
    vi.mocked(warehousesApi.listWarehouses).mockResolvedValue({
      data: [],
      page: 1,
      pageSize: 100,
      total: 0,
    })
    vi.mocked(warehousesApi.listDestinations).mockResolvedValue([])
    vi.mocked(productsApi.listProducts).mockResolvedValue({
      data: [],
      page: 1,
      pageSize: 100,
      total: 0,
    })
    const store = useTransfersStore()
    await store.loadOptions()
    expect(store.optionsFetchedAt).not.toBeNull()

    useWarehousesStore().invalidate()
    expect(store.optionsFetchedAt).toBeNull()

    await store.loadOptions()
    useProductsStore().invalidate()
    expect(store.optionsFetchedAt).toBeNull()
  })
})

describe('store transfers: solo bodegas', () => {
  it('loadWarehouses pide las bodegas asignadas y los destinos, sin productos', async () => {
    vi.mocked(warehousesApi.listWarehouses).mockResolvedValue({
      data: [{ ...A, active: true, createdAt: '' }],
      page: 1,
      pageSize: 100,
      total: 1,
    })
    vi.mocked(warehousesApi.listDestinations).mockResolvedValue([A, B])
    const store = useTransfersStore()

    await store.loadWarehouses()
    await store.loadWarehouses()

    expect(store.origins).toEqual([A])
    expect(store.destinations).toEqual([A, B])
    expect(productsApi.listProducts).not.toHaveBeenCalled()
    expect(warehousesApi.listDestinations).toHaveBeenCalledTimes(1)
  })

  it('si falla no rompe nada: quedan sin bodegas y la próxima vez vuelve a pedirlas', async () => {
    vi.mocked(warehousesApi.listWarehouses).mockRejectedValueOnce(
      new ApiError('Caído', 503, null, null),
    )
    vi.mocked(warehousesApi.listDestinations).mockResolvedValue([A, B])
    const store = useTransfersStore()

    await store.loadWarehouses()
    expect(store.origins).toEqual([])
    expect(store.warehousesFetchedAt).toBeNull()

    vi.mocked(warehousesApi.listWarehouses).mockResolvedValue({
      data: [{ ...A, active: true, createdAt: '' }],
      page: 1,
      pageSize: 100,
      total: 1,
    })
    await store.loadWarehouses()
    expect(store.origins).toEqual([A])
  })
})

describe('caché con TTL de transfers', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('dos fetchPage seguidos de la misma consulta hacen una sola petición', async () => {
    vi.mocked(api.listTransfers).mockResolvedValue(pageOf(['t1']))
    const store = useTransfersStore()

    await store.fetchPage()
    await store.fetchPage()

    expect(api.listTransfers).toHaveBeenCalledTimes(1)
  })

  it('con force o pasado el TTL vuelve a pedir', async () => {
    vi.mocked(api.listTransfers).mockResolvedValue(pageOf(['t1']))
    const store = useTransfersStore()
    await store.fetchPage()

    await store.fetchPage(1, { force: true })
    expect(api.listTransfers).toHaveBeenCalledTimes(2)

    vi.advanceTimersByTime(CACHE_TTL_MS + 1)
    await store.fetchPage()
    expect(api.listTransfers).toHaveBeenCalledTimes(3)
  })

  it('una página u otro filtro es otra consulta: siempre va al servidor', async () => {
    vi.mocked(api.listTransfers).mockResolvedValue(pageOf(['t1'], 1, 30))
    const store = useTransfersStore()
    await store.fetchPage(1)

    await store.fetchPage(2)

    expect(api.listTransfers).toHaveBeenCalledTimes(2)
  })

  it('fetchDetail no repite la petición mientras el detalle sigue vigente', async () => {
    vi.mocked(api.getTransfer).mockResolvedValue(detail('t1'))
    const store = useTransfersStore()

    await store.fetchDetail('t1')
    await store.fetchDetail('t1')
    expect(api.getTransfer).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(CACHE_TTL_MS + 1)
    await store.fetchDetail('t1')
    expect(api.getTransfer).toHaveBeenCalledTimes(2)
  })

  it('invalidate descarta listado y detalle', async () => {
    vi.mocked(api.listTransfers).mockResolvedValue(pageOf(['t1']))
    vi.mocked(api.getTransfer).mockResolvedValue(detail('t1'))
    const store = useTransfersStore()
    await store.fetchPage()
    await store.fetchDetail('t1')

    store.invalidate()
    await store.fetchPage()
    await store.fetchDetail('t1')

    expect(api.listTransfers).toHaveBeenCalledTimes(2)
    expect(api.getTransfer).toHaveBeenCalledTimes(2)
  })
})
