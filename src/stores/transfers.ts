import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { listProducts } from '@/api/products'
import * as api from '@/api/transfers'
import { listDestinations, listWarehouses } from '@/api/warehouses'
import { toApiError } from '@/api/http'
import { useTtlCache } from '@/composables/useTtlCache'
import { useStockStore } from './stock'
import type { LoadStatus } from '@/types/api'
import type { Product } from '@/types/product'
import type {
  TransferDetail,
  TransferFilters,
  TransferInput,
  TransferSummary,
  WarehouseRef,
} from '@/types/transfer'

/** Máximo que admite la API por página: los selectores del borrador muestran hasta tantas opciones. */
const OPTIONS_PAGE_SIZE = 100

/**
 * Store del dominio "traspasos": el listado normalizado (`byId` + `ids` de la página actual), el
 * detalle de los traspasos consultados, las acciones (crear, cancelar, despachar) y las opciones
 * del formulario de borrador.
 */
export const useTransfersStore = defineStore('transfers', () => {
  // Listado
  const byId = ref<Record<string, TransferSummary>>({})
  const ids = ref<string[]>([])
  const page = ref(1)
  const pageSize = ref(10)
  const total = ref(0)
  const status = ref<LoadStatus>('idle')
  const error = ref<string | null>(null)
  const filters = ref<TransferFilters>({ status: '', warehouseId: '' })
  const listCache = useTtlCache()
  let listRequest = 0

  // Detalle
  const details = ref<Record<string, TransferDetail>>({})
  const detailStatus = ref<LoadStatus>('idle')
  const detailError = ref<string | null>(null)
  const detailCache = useTtlCache()
  let detailRequest = 0

  // Acciones sobre un traspaso (cancelar, despachar) y creación del borrador
  const acting = ref(false)
  const actionError = ref<string | null>(null)
  const saving = ref(false)
  const saveError = ref<string | null>(null)

  // Opciones del formulario de borrador
  const origins = ref<WarehouseRef[]>([])
  const destinations = ref<WarehouseRef[]>([])
  const products = ref<Product[]>([])
  const optionsStatus = ref<LoadStatus>('idle')
  const optionsError = ref<string | null>(null)
  const optionsCache = useTtlCache()
  // Solo las bodegas (origen y destino): el filtro del listado y los botones del detalle
  const warehousesCache = useTtlCache()

  // Sube al terminar la sesión: lo que estaba en vuelo se descarta al llegar (ver `cancelPending`)
  let session = 0

  const items = computed<TransferSummary[]>(() =>
    ids.value.flatMap((id) => {
      const transfer = byId.value[id]
      return transfer ? [transfer] : []
    }),
  )
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

  /** Carga una página del listado. Si es la misma consulta y sigue vigente (TTL), no la vuelve a pedir. */
  async function fetchPage(
    target: number = page.value,
    { force = false }: { force?: boolean } = {},
  ): Promise<void> {
    const key = `${filters.value.status}|${filters.value.warehouseId}|${target}`
    if (!force && listCache.isFresh(key)) return
    const request = ++listRequest
    status.value = 'loading'
    error.value = null
    try {
      const result = await api.listTransfers(filters.value, target, pageSize.value)
      if (request !== listRequest) return
      byId.value = { ...byId.value, ...Object.fromEntries(result.data.map((t) => [t.id, t])) }
      ids.value = result.data.map((t) => t.id)
      page.value = result.page
      total.value = result.total
      listCache.markFetched(key)
      status.value = 'success'
    } catch (err) {
      if (request !== listRequest) return
      listCache.invalidate()
      error.value = toApiError(err).message
      status.value = 'error'
    }
  }

  /** Cambia los filtros y vuelve a la primera página. */
  async function setFilters(next: Partial<TransferFilters>): Promise<void> {
    filters.value = { ...filters.value, ...next }
    await fetchPage(1)
  }

  /**
   * Carga el detalle de un traspaso. Si ya hay uno cargado, la vista lo sigue mostrando mientras
   * se actualiza (el estado `loading` solo se nota cuando todavía no hay nada que mostrar).
   */
  async function fetchDetail(
    id: string,
    { force = false }: { force?: boolean } = {},
  ): Promise<void> {
    if (!force && details.value[id] && detailCache.isFresh(id)) return
    const request = ++detailRequest
    detailStatus.value = 'loading'
    detailError.value = null
    try {
      const detail = await api.getTransfer(id)
      if (request !== detailRequest) return
      storeDetail(detail)
      detailCache.markFetched(id)
      detailStatus.value = 'success'
    } catch (err) {
      if (request !== detailRequest) return
      detailCache.invalidate()
      detailError.value = toApiError(err).message
      detailStatus.value = 'error'
    }
  }

  /** Guarda el detalle y mantiene al día el estado de su fila del listado, si está cargada. */
  function storeDetail(detail: TransferDetail): void {
    details.value = { ...details.value, [detail.id]: detail }
    const row = byId.value[detail.id]
    if (row) {
      byId.value = {
        ...byId.value,
        [detail.id]: { ...row, status: detail.status, updatedAt: detail.updatedAt },
      }
    }
  }

  /** Crea el borrador. Devuelve su id, o null y deja `saveError` si falla. */
  async function create(input: TransferInput): Promise<string | null> {
    if (saving.value) return null
    saving.value = true
    saveError.value = null
    const started = session
    try {
      const detail = await api.createTransfer(input)
      if (started !== session) return null
      storeDetail(detail)
      detailCache.markFetched(detail.id)
      listCache.invalidate()
      return detail.id
    } catch (err) {
      saveError.value = toApiError(err).message
      return null
    } finally {
      saving.value = false
    }
  }

  /**
   * Ejecuta una acción sobre un traspaso. Mientras corre, `acting` bloquea otra acción (el doble
   * clic no envía dos peticiones). Si el servidor responde 409 (otro la hizo antes o cambió el
   * estado) se muestra su mensaje y se recarga el traspaso para ver su estado real.
   */
  async function act(id: string, call: () => Promise<TransferDetail>): Promise<boolean> {
    if (acting.value) return false
    acting.value = true
    actionError.value = null
    const started = session
    try {
      const detail = await call()
      if (started !== session) return false
      storeDetail(detail)
      detailCache.markFetched(id)
      listCache.invalidate()
      return true
    } catch (err) {
      if (started !== session) return false
      const apiError = toApiError(err)
      actionError.value = apiError.message
      if (apiError.status === 409) await fetchDetail(id, { force: true })
      return false
    } finally {
      acting.value = false
    }
  }

  function cancel(id: string, reason?: string): Promise<boolean> {
    return act(id, () => api.cancelTransfer(id, reason))
  }

  /** Despacha: además de la caché de traspasos, descarta la de stock (el origen quedó con menos). */
  async function dispatch(id: string): Promise<boolean> {
    const done = await act(id, () => api.dispatchTransfer(id))
    if (done) useStockStore().invalidate()
    return done
  }

  /**
   * Bodegas de origen (las asignadas y activas: la API del listado ya filtra por asignación) y de
   * destino (todas las activas).
   */
  async function fetchWarehouseRefs(): Promise<void> {
    const [assigned, allDestinations] = await Promise.all([
      listWarehouses(1, OPTIONS_PAGE_SIZE),
      listDestinations(),
    ])
    origins.value = assigned.data
      .filter((w) => w.active)
      .map(({ id, code, name }) => ({ id, code, name }))
    destinations.value = allDestinations
    warehousesCache.markFetched()
  }

  /**
   * Carga solo las bodegas: para el filtro del listado y para saber si el origen de un traspaso es
   * de quien lo mira. Si falla, el filtro queda sin bodegas y el detalle no muestra acciones (la
   * API decide igual), así que no tiene estado propio.
   */
  async function loadWarehouses({ force = false }: { force?: boolean } = {}): Promise<void> {
    if (!force && warehousesCache.isFresh()) return
    try {
      await fetchWarehouseRefs()
    } catch {
      warehousesCache.invalidate()
    }
  }

  /** Carga las opciones del borrador. Si siguen vigentes (TTL) no las vuelve a pedir, salvo con `force`. */
  async function loadOptions({ force = false }: { force?: boolean } = {}): Promise<void> {
    if (!force && optionsCache.isFresh()) return
    optionsStatus.value = 'loading'
    optionsError.value = null
    try {
      const [, productPage] = await Promise.all([
        fetchWarehouseRefs(),
        listProducts(1, OPTIONS_PAGE_SIZE),
      ])
      products.value = productPage.data
      optionsCache.markFetched()
      optionsStatus.value = 'success'
    } catch (err) {
      optionsCache.invalidate()
      optionsError.value = toApiError(err).message
      optionsStatus.value = 'error'
    }
  }

  /** Descarta listado y detalle: tras mover stock o cambiar un traspaso desde otra parte de la interfaz. */
  function invalidate(): void {
    listCache.invalidate()
    detailCache.invalidate()
  }

  /** Descarta las opciones del borrador: tras crear o editar una bodega o un producto. */
  function invalidateOptions(): void {
    optionsCache.invalidate()
    warehousesCache.invalidate()
  }

  /**
   * Hace que las respuestas que sigan en vuelo se descarten al llegar. Lo usa el plugin que vacía
   * los stores al cerrar la sesión: sin esto, una respuesta pedida por la persona anterior (con
   * costos) volvería a llenar el store después de vaciarlo.
   */
  function cancelPending(): void {
    listRequest++
    detailRequest++
    session++
  }

  function clearActionError(): void {
    actionError.value = null
  }

  function clearSaveError(): void {
    saveError.value = null
  }

  return {
    byId,
    ids,
    page,
    pageSize,
    total,
    status,
    error,
    filters,
    items,
    totalPages,
    lastFetchedAt: listCache.lastFetchedAt,
    details,
    detailFetchedAt: detailCache.lastFetchedAt,
    detailStatus,
    detailError,
    acting,
    actionError,
    saving,
    saveError,
    origins,
    destinations,
    products,
    optionsStatus,
    optionsError,
    optionsFetchedAt: optionsCache.lastFetchedAt,
    warehousesFetchedAt: warehousesCache.lastFetchedAt,
    fetchPage,
    setFilters,
    fetchDetail,
    create,
    cancel,
    dispatch,
    loadOptions,
    loadWarehouses,
    cancelPending,
    invalidate,
    invalidateOptions,
    clearActionError,
    clearSaveError,
  }
})
