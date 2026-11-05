import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { listProducts } from '@/api/products'
import { listStockLevels, listStockMovements } from '@/api/stock'
import { listWarehouses } from '@/api/warehouses'
import { toApiError } from '@/api/http'
import { useTtlCache } from '@/composables/useTtlCache'
import type { LoadStatus } from '@/types/api'
import type { Product } from '@/types/product'
import type { StockLevelItem, StockMovementItem } from '@/types/stock'
import type { Warehouse } from '@/types/warehouse'

/** Máximo que admite la API por página: los selectores muestran hasta tantas opciones. */
const OPTIONS_PAGE_SIZE = 100
const PAGE_SIZE = 10

/**
 * Store de consulta de stock: la bodega elegida, sus existencias y su historial de movimientos.
 * Las opciones de los selectores (bodegas y productos) se cargan aparte para no alterar la
 * paginación de los stores de bodegas y productos.
 */
export const useStockStore = defineStore('stock', () => {
  const warehouses = ref<Warehouse[]>([])
  const products = ref<Product[]>([])
  const optionsStatus = ref<LoadStatus>('idle')
  const optionsError = ref<string | null>(null)
  const optionsCache = useTtlCache()

  const warehouseId = ref('')
  const productId = ref('')

  const levelsById = ref<Record<string, StockLevelItem>>({})
  const levelIds = ref<string[]>([])
  const levelsPage = ref(1)
  const levelsTotal = ref(0)
  const levelsStatus = ref<LoadStatus>('idle')
  const levelsError = ref<string | null>(null)
  const levelsCache = useTtlCache()

  const movementsById = ref<Record<string, StockMovementItem>>({})
  const movementIds = ref<string[]>([])
  /** Cursor de la página siguiente del historial; null si ya se cargó todo. */
  const movementsNextCursor = ref<string | null>(null)
  const movementsStatus = ref<LoadStatus>('idle')
  const movementsError = ref<string | null>(null)
  // "Cargar más" tiene su propio estado: si falla, la lista ya cargada se sigue viendo
  const moreMovementsStatus = ref<LoadStatus>('idle')
  const moreMovementsError = ref<string | null>(null)
  const movementsCache = useTtlCache()

  // Si el usuario cambia de bodega mientras llega una respuesta, esa respuesta ya no aplica.
  let levelsRequest = 0
  let movementsRequest = 0

  const levels = computed<StockLevelItem[]>(() =>
    levelIds.value.flatMap((id) => {
      const level = levelsById.value[id]
      return level ? [level] : []
    }),
  )
  const movements = computed<StockMovementItem[]>(() =>
    movementIds.value.flatMap((id) => {
      const movement = movementsById.value[id]
      return movement ? [movement] : []
    }),
  )
  const levelsPages = computed(() => Math.max(1, Math.ceil(levelsTotal.value / PAGE_SIZE)))
  const hasMoreMovements = computed(() => movementsNextCursor.value !== null)

  /** Carga las opciones de los selectores. Si siguen vigentes (TTL) no las vuelve a pedir, salvo con `force`. */
  async function loadOptions({ force = false }: { force?: boolean } = {}): Promise<void> {
    if (!force && optionsCache.isFresh()) return
    optionsStatus.value = 'loading'
    optionsError.value = null
    try {
      const [warehousePage, productPage] = await Promise.all([
        listWarehouses(1, OPTIONS_PAGE_SIZE),
        listProducts(1, OPTIONS_PAGE_SIZE),
      ])
      warehouses.value = warehousePage.data
      products.value = productPage.data
      optionsCache.markFetched()
      optionsStatus.value = 'success'
    } catch (err) {
      optionsCache.invalidate()
      optionsError.value = toApiError(err).message
      optionsStatus.value = 'error'
    }
  }

  /**
   * Carga una página de existencias. Con `silent` (recarga por un aviso en vivo) la tabla actual se
   * sigue viendo mientras llega la respuesta y, si la recarga falla, se queda como estaba.
   */
  async function fetchLevels(
    target: number = levelsPage.value,
    { force = false, silent = false }: { force?: boolean; silent?: boolean } = {},
  ): Promise<void> {
    if (!warehouseId.value) return
    const key = `${warehouseId.value}|${target}`
    if (!force && levelsCache.isFresh(key)) return
    const request = ++levelsRequest
    if (!silent) {
      levelsStatus.value = 'loading'
      levelsError.value = null
    }
    try {
      const result = await listStockLevels(warehouseId.value, target, PAGE_SIZE)
      if (request !== levelsRequest) return
      levelsById.value = Object.fromEntries(result.data.map((l) => [l.productId, l]))
      levelIds.value = result.data.map((l) => l.productId)
      levelsPage.value = result.page
      levelsTotal.value = result.total
      levelsCache.markFetched(key)
      levelsStatus.value = 'success'
      levelsError.value = null
    } catch (err) {
      if (request !== levelsRequest) return
      levelsCache.invalidate()
      if (silent && levelsStatus.value === 'success') return
      levelsError.value = toApiError(err).message
      levelsStatus.value = 'error'
    }
  }

  /**
   * Primera página del historial (reemplaza la lista). La caché recuerda solo esa página. Con
   * `silent`, igual que en `fetchLevels`: no se muestra "Cargando" ni se pierde la lista si falla.
   */
  async function fetchMovements({
    force = false,
    silent = false,
  }: { force?: boolean; silent?: boolean } = {}): Promise<void> {
    if (!warehouseId.value) return
    const key = `${warehouseId.value}|${productId.value}`
    if (!force && movementsCache.isFresh(key)) return
    const request = ++movementsRequest
    if (!silent) {
      movementsStatus.value = 'loading'
      movementsError.value = null
    }
    moreMovementsStatus.value = 'idle'
    moreMovementsError.value = null
    try {
      const result = await listStockMovements(
        warehouseId.value,
        productId.value || undefined,
        PAGE_SIZE,
      )
      if (request !== movementsRequest) return
      movementsById.value = Object.fromEntries(result.data.map((m) => [m.id, m]))
      movementIds.value = result.data.map((m) => m.id)
      movementsNextCursor.value = result.nextCursor
      movementsCache.markFetched(key)
      movementsStatus.value = 'success'
      movementsError.value = null
    } catch (err) {
      if (request !== movementsRequest) return
      movementsCache.invalidate()
      if (silent && movementsStatus.value === 'success') return
      movementsError.value = toApiError(err).message
      movementsStatus.value = 'error'
    }
  }

  /** "Cargar más": pide la página siguiente con el cursor y la agrega al final de la lista. */
  async function loadMoreMovements(): Promise<void> {
    const cursor = movementsNextCursor.value
    if (!warehouseId.value || cursor === null || moreMovementsStatus.value === 'loading') return
    // Comparte el contador con fetchMovements: si cambia la bodega o el producto, se descarta
    const request = ++movementsRequest
    moreMovementsStatus.value = 'loading'
    moreMovementsError.value = null
    try {
      const result = await listStockMovements(
        warehouseId.value,
        productId.value || undefined,
        PAGE_SIZE,
        cursor,
      )
      if (request !== movementsRequest) return
      for (const m of result.data) {
        // El cursor no repite filas, pero así una respuesta duplicada tampoco las repetiría
        if (!movementsById.value[m.id]) movementIds.value.push(m.id)
        movementsById.value[m.id] = m
      }
      movementsNextCursor.value = result.nextCursor
      moreMovementsStatus.value = 'success'
    } catch (err) {
      if (request !== movementsRequest) return
      moreMovementsError.value = toApiError(err).message
      moreMovementsStatus.value = 'error'
    }
  }

  /** Cambia de bodega: reinicia el filtro de producto y recarga existencias e historial. */
  async function selectWarehouse(id: string): Promise<void> {
    warehouseId.value = id
    productId.value = ''
    levelIds.value = []
    movementIds.value = []
    movementsNextCursor.value = null
    levelsCache.invalidate()
    movementsCache.invalidate()
    if (!id) {
      levelsRequest++
      movementsRequest++
      levelsStatus.value = 'idle'
      movementsStatus.value = 'idle'
      return
    }
    await Promise.all([fetchLevels(1), fetchMovements()])
  }

  /**
   * Hace que las respuestas que sigan en vuelo se descarten al llegar. Lo usa el plugin que vacía
   * los stores al cerrar la sesión: sin esto, una respuesta pedida por la persona anterior (con
   * costos) volvería a llenar el store después de vaciarlo.
   */
  function cancelPending(): void {
    levelsRequest++
    movementsRequest++
  }

  /** Descarta existencias e historial: tras mover stock (una entrada, un traspaso, una merma). */
  function invalidate(): void {
    levelsCache.invalidate()
    movementsCache.invalidate()
  }

  /**
   * Aviso en vivo de que cambió el stock de una bodega: descarta la caché y, si esa bodega es la que
   * está en pantalla, vuelve a pedir sus existencias y su historial (desde la primera página).
   */
  async function refreshAfterEvent(changedWarehouseId: string, onScreen: boolean): Promise<void> {
    invalidate()
    if (!onScreen || changedWarehouseId !== warehouseId.value) return
    await Promise.all([
      fetchLevels(levelsPage.value, { force: true, silent: true }),
      fetchMovements({ force: true, silent: true }),
    ])
  }

  /** Descarta las opciones de los selectores: tras crear o editar una bodega o un producto. */
  function invalidateOptions(): void {
    optionsCache.invalidate()
  }

  /** Filtra el historial por producto (cadena vacía = todos). */
  async function selectProduct(id: string): Promise<void> {
    productId.value = id
    await fetchMovements()
  }

  return {
    warehouses,
    products,
    optionsStatus,
    optionsError,
    optionsFetchedAt: optionsCache.lastFetchedAt,
    levelsFetchedAt: levelsCache.lastFetchedAt,
    movementsFetchedAt: movementsCache.lastFetchedAt,
    warehouseId,
    productId,
    levels,
    levelsPage,
    levelsPages,
    levelsTotal,
    levelsStatus,
    levelsError,
    movements,
    hasMoreMovements,
    movementsStatus,
    movementsError,
    moreMovementsStatus,
    moreMovementsError,
    loadOptions,
    fetchLevels,
    fetchMovements,
    loadMoreMovements,
    selectWarehouse,
    selectProduct,
    invalidate,
    refreshAfterEvent,
    invalidateOptions,
    cancelPending,
  }
})
