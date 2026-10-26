import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import * as api from '@/api/warehouses'
import { ApiError } from '@/api/http'
import { useWarehousesStore } from './warehouses'
import { useStockStore } from './stock'
import { useStockEntriesStore } from './stockEntries'
import { CACHE_TTL_MS } from '@/composables/useTtlCache'
import type { Warehouse } from '@/types/warehouse'

vi.mock('@/api/warehouses')

function warehouse(code: string): Warehouse {
  return { id: `id-${code}`, code, name: `Bodega ${code}`, active: true, createdAt: '2026-01-01' }
}

function pageOf(codes: string[], page = 1, total = codes.length) {
  return { data: codes.map(warehouse), page, pageSize: 10, total }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

describe('store warehouses', () => {
  it('empieza en idle y vacío', () => {
    const store = useWarehousesStore()
    expect(store.status).toBe('idle')
    expect(store.items).toEqual([])
  })

  it('fetchPage pasa por loading y deja los datos normalizados', async () => {
    vi.mocked(api.listWarehouses).mockResolvedValue(pageOf(['A', 'B'], 1, 12))
    const store = useWarehousesStore()

    const pending = store.fetchPage()
    expect(store.status).toBe('loading')
    await pending

    expect(store.status).toBe('success')
    expect(store.ids).toEqual(['id-A', 'id-B'])
    expect(store.byId['id-A']?.name).toBe('Bodega A')
    expect(store.items.map((w) => w.code)).toEqual(['A', 'B'])
    expect(store.total).toBe(12)
    expect(store.totalPages).toBe(2)
  })

  it('fetchPage pide la página indicada', async () => {
    vi.mocked(api.listWarehouses).mockResolvedValue(pageOf(['C'], 2, 11))
    const store = useWarehousesStore()

    await store.fetchPage(2)

    expect(api.listWarehouses).toHaveBeenCalledWith(2, 10)
    expect(store.page).toBe(2)
  })

  it('si la carga falla queda en error con el mensaje', async () => {
    vi.mocked(api.listWarehouses).mockRejectedValue(new ApiError('Sin permiso', 401, null, null))
    const store = useWarehousesStore()

    await store.fetchPage()

    expect(store.status).toBe('error')
    expect(store.error).toBe('Sin permiso')
  })

  it('save crea una bodega y recarga la página', async () => {
    vi.mocked(api.createWarehouse).mockResolvedValue(warehouse('A'))
    vi.mocked(api.listWarehouses).mockResolvedValue(pageOf(['A']))
    const store = useWarehousesStore()

    const ok = await store.save({ code: 'A', name: 'Bodega A', active: true })

    expect(ok).toBe(true)
    expect(api.createWarehouse).toHaveBeenCalledWith({ code: 'A', name: 'Bodega A', active: true })
    expect(api.listWarehouses).toHaveBeenCalledTimes(1)
    expect(store.saving).toBe(false)
  })

  it('save con id edita la bodega', async () => {
    vi.mocked(api.updateWarehouse).mockResolvedValue(warehouse('A'))
    vi.mocked(api.listWarehouses).mockResolvedValue(pageOf(['A']))
    const store = useWarehousesStore()

    await store.save({ code: 'A', name: 'Nuevo', active: false }, 'id-A')

    expect(api.updateWarehouse).toHaveBeenCalledWith('id-A', {
      code: 'A',
      name: 'Nuevo',
      active: false,
    })
  })

  it('si guardar falla (código repetido) devuelve false, deja saveError y no recarga', async () => {
    vi.mocked(api.createWarehouse).mockRejectedValue(
      new ApiError('Ya existe una bodega con ese código', 409, 'CONFLICT', 'abc'),
    )
    const store = useWarehousesStore()

    const ok = await store.save({ code: 'A', name: 'Bodega A', active: true })

    expect(ok).toBe(false)
    expect(store.saveError).toBe('Ya existe una bodega con ese código')
    expect(store.saving).toBe(false)
    expect(api.listWarehouses).not.toHaveBeenCalled()
  })

  it('clearSaveError limpia el error de guardado', async () => {
    vi.mocked(api.createWarehouse).mockRejectedValue(new ApiError('x', 400, null, null))
    const store = useWarehousesStore()
    await store.save({ code: 'A', name: 'A', active: true })

    store.clearSaveError()

    expect(store.saveError).toBeNull()
  })
})

describe('caché con TTL de warehouses', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('dos fetchPage seguidos de la misma página hacen una sola petición', async () => {
    vi.mocked(api.listWarehouses).mockResolvedValue(pageOf(['A']))
    const store = useWarehousesStore()

    await store.fetchPage()
    await store.fetchPage()

    expect(api.listWarehouses).toHaveBeenCalledTimes(1)
    expect(store.lastFetchedAt).not.toBeNull()
  })

  it('con force vuelve a pedir', async () => {
    vi.mocked(api.listWarehouses).mockResolvedValue(pageOf(['A']))
    const store = useWarehousesStore()

    await store.fetchPage()
    await store.fetchPage(1, { force: true })

    expect(api.listWarehouses).toHaveBeenCalledTimes(2)
  })

  it('pasado el TTL vuelve a pedir', async () => {
    vi.mocked(api.listWarehouses).mockResolvedValue(pageOf(['A']))
    const store = useWarehousesStore()

    await store.fetchPage()
    vi.advanceTimersByTime(CACHE_TTL_MS)
    await store.fetchPage()

    expect(api.listWarehouses).toHaveBeenCalledTimes(2)
  })

  it('pedir otra página siempre va al servidor', async () => {
    vi.mocked(api.listWarehouses).mockResolvedValue(pageOf(['A'], 1, 12))
    const store = useWarehousesStore()

    await store.fetchPage(1)
    await store.fetchPage(2)

    expect(api.listWarehouses).toHaveBeenCalledTimes(2)
  })

  it('si la carga falla no queda en caché: reintentar vuelve a pedir', async () => {
    vi.mocked(api.listWarehouses)
      .mockRejectedValueOnce(new ApiError('Sin conexión', null, null, null))
      .mockResolvedValueOnce(pageOf(['A']))
    const store = useWarehousesStore()

    await store.fetchPage()
    expect(store.lastFetchedAt).toBeNull()
    await store.fetchPage()

    expect(api.listWarehouses).toHaveBeenCalledTimes(2)
    expect(store.status).toBe('success')
  })

  it('una mutación invalida la caché: save recarga aunque los datos sean recientes', async () => {
    vi.mocked(api.createWarehouse).mockResolvedValue(warehouse('B'))
    vi.mocked(api.listWarehouses).mockResolvedValue(pageOf(['A']))
    const store = useWarehousesStore()
    await store.fetchPage()

    await store.save({ code: 'B', name: 'Bodega B', active: true })

    expect(api.listWarehouses).toHaveBeenCalledTimes(2)
  })

  it('una mutación que falla no invalida la caché', async () => {
    vi.mocked(api.createWarehouse).mockRejectedValue(new ApiError('Ya existe', 409, null, null))
    vi.mocked(api.listWarehouses).mockResolvedValue(pageOf(['A']))
    const store = useWarehousesStore()
    await store.fetchPage()

    await store.save({ code: 'A', name: 'Bodega A', active: true })
    await store.fetchPage()

    expect(api.listWarehouses).toHaveBeenCalledTimes(1)
  })

  it('al guardar también se invalidan las opciones de stock y de entradas', async () => {
    vi.mocked(api.createWarehouse).mockResolvedValue(warehouse('B'))
    vi.mocked(api.listWarehouses).mockResolvedValue(pageOf(['A']))
    const invalidateStock = vi.spyOn(useStockStore(), 'invalidateOptions')
    const invalidateEntries = vi.spyOn(useStockEntriesStore(), 'invalidateOptions')

    await useWarehousesStore().save({ code: 'B', name: 'Bodega B', active: true })

    expect(invalidateStock).toHaveBeenCalledTimes(1)
    expect(invalidateEntries).toHaveBeenCalledTimes(1)
  })
})
