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
  const movementsPage = ref(1)
  const movementsTotal = ref(0)
  const movementsStatus = ref<LoadStatus>('idle')
  const movementsError = ref<string | null>(null)
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
  const movementsPages = computed(() => Math.max(1, Math.ceil(movementsTotal.value / PAGE_SIZE)))

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

  async function fetchLevels(
    target: number = levelsPage.value,
    { force = false }: { force?: boolean } = {},
  ): Promise<void> {
    if (!warehouseId.value) return
    const key = `${warehouseId.value}|${target}`
    if (!force && levelsCache.isFresh(key)) return
    const request = ++levelsRequest
    levelsStatus.value = 'loading'
    levelsError.value = null
    try {
      const result = await listStockLevels(warehouseId.value, target, PAGE_SIZE)
      if (request !== levelsRequest) return
      levelsById.value = Object.fromEntries(result.data.map((l) => [l.productId, l]))
      levelIds.value = result.data.map((l) => l.productId)
      levelsPage.value = result.page
      levelsTotal.value = result.total
      levelsCache.markFetched(key)
      levelsStatus.value = 'success'
    } catch (err) {
      if (request !== levelsRequest) return
      levelsCache.invalidate()
      levelsError.value = toApiError(err).message
      levelsStatus.value = 'error'
    }
  }

  async function fetchMovements(
    target: number = movementsPage.value,
    { force = false }: { force?: boolean } = {},
  ): Promise<void> {
    if (!warehouseId.value) return
    const key = `${warehouseId.value}|${productId.value}|${target}`
    if (!force && movementsCache.isFresh(key)) return
    const request = ++movementsRequest
    movementsStatus.value = 'loading'
    movementsError.value = null
    try {
      const result = await listStockMovements(
        warehouseId.value,
        productId.value || undefined,
        target,
        PAGE_SIZE,
      )
      if (request !== movementsRequest) return
      movementsById.value = Object.fromEntries(result.data.map((m) => [m.id, m]))
      movementIds.value = result.data.map((m) => m.id)
      movementsPage.value = result.page
      movementsTotal.value = result.total
      movementsCache.markFetched(key)
      movementsStatus.value = 'success'
    } catch (err) {
      if (request !== movementsRequest) return
      movementsCache.invalidate()
      movementsError.value = toApiError(err).message
      movementsStatus.value = 'error'
    }
  }

  /** Cambia de bodega: reinicia el filtro de producto y recarga existencias e historial. */
  async function selectWarehouse(id: string): Promise<void> {
    warehouseId.value = id
    productId.value = ''
    levelIds.value = []
    movementIds.value = []
    levelsCache.invalidate()
    movementsCache.invalidate()
    if (!id) {
      levelsRequest++
      movementsRequest++
      levelsStatus.value = 'idle'
      movementsStatus.value = 'idle'
      return
    }
    await Promise.all([fetchLevels(1), fetchMovements(1)])
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

  /** Descarta las opciones de los selectores: tras crear o editar una bodega o un producto. */
  function invalidateOptions(): void {
    optionsCache.invalidate()
  }

  /** Filtra el historial por producto (cadena vacía = todos). */
  async function selectProduct(id: string): Promise<void> {
    productId.value = id
    await fetchMovements(1)
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
    movementsPage,
    movementsPages,
    movementsTotal,
    movementsStatus,
    movementsError,
    loadOptions,
    fetchLevels,
    fetchMovements,
    selectWarehouse,
    selectProduct,
    invalidate,
    invalidateOptions,
    cancelPending,
  }
})
