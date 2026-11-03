import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getInTransitReport, getKardex, getShrinkageReport } from '@/api/reports'
import { toApiError } from '@/api/http'
import type { LoadStatus } from '@/types/api'
import type {
  InTransitReport,
  KardexPage,
  KardexRow,
  ShrinkageFilters,
  ShrinkageReport,
} from '@/types/report'

const PAGE_SIZE = 20

/**
 * Store de reportes (kardex, mermas y mercancía en tránsito). No usa la caché con TTL: son
 * reportes de auditoría y cada consulta va al servidor para mostrar el libro al día.
 */
export const useReportsStore = defineStore('reports', () => {
  // Reportes de mermas y en tránsito: son listas cortas ya agregadas por el servidor, así que se
  // guardan tal como llegan (no hay entidades que normalizar)
  const shrinkage = ref<ShrinkageReport | null>(null)
  const shrinkageStatus = ref<LoadStatus>('idle')
  const shrinkageError = ref<string | null>(null)
  const inTransit = ref<InTransitReport | null>(null)
  const inTransitStatus = ref<LoadStatus>('idle')
  const inTransitError = ref<string | null>(null)
  let shrinkageRequest = 0
  let inTransitRequest = 0

  const kardexWarehouseId = ref('')
  const kardexProductId = ref('')
  const kardexById = ref<Record<string, KardexRow>>({})
  const kardexIds = ref<string[]>([])
  const kardexWarehouse = ref<KardexPage['warehouse'] | null>(null)
  const kardexProduct = ref<KardexPage['product'] | null>(null)
  const kardexNextCursor = ref<string | null>(null)
  const kardexStatus = ref<LoadStatus>('idle')
  const kardexError = ref<string | null>(null)
  // "Cargar más" tiene su propio estado: si falla, las filas ya cargadas se siguen viendo
  const moreKardexStatus = ref<LoadStatus>('idle')
  const moreKardexError = ref<string | null>(null)

  // Si cambia la selección mientras llega una respuesta, esa respuesta ya no aplica
  let kardexRequest = 0

  const kardex = computed<KardexRow[]>(() =>
    kardexIds.value.flatMap((id) => {
      const row = kardexById.value[id]
      return row ? [row] : []
    }),
  )
  const hasMoreKardex = computed(() => kardexNextCursor.value !== null)

  /** Primera página del kardex de un producto en una bodega (reemplaza lo que había). */
  async function loadKardex(warehouseId: string, productId: string): Promise<void> {
    kardexWarehouseId.value = warehouseId
    kardexProductId.value = productId
    const request = ++kardexRequest
    kardexIds.value = []
    kardexById.value = {}
    kardexNextCursor.value = null
    moreKardexStatus.value = 'idle'
    moreKardexError.value = null
    if (!warehouseId || !productId) {
      kardexStatus.value = 'idle'
      return
    }
    kardexStatus.value = 'loading'
    kardexError.value = null
    try {
      const page = await getKardex(warehouseId, productId, PAGE_SIZE)
      if (request !== kardexRequest) return
      kardexById.value = Object.fromEntries(page.data.map((row) => [row.id, row]))
      kardexIds.value = page.data.map((row) => row.id)
      kardexWarehouse.value = page.warehouse
      kardexProduct.value = page.product
      kardexNextCursor.value = page.nextCursor
      kardexStatus.value = 'success'
    } catch (err) {
      if (request !== kardexRequest) return
      kardexError.value = toApiError(err).message
      kardexStatus.value = 'error'
    }
  }

  /** "Cargar más": la página siguiente con el cursor, agregada al final (orden cronológico). */
  async function loadMoreKardex(): Promise<void> {
    const cursor = kardexNextCursor.value
    if (cursor === null || moreKardexStatus.value === 'loading') return
    const request = ++kardexRequest
    moreKardexStatus.value = 'loading'
    moreKardexError.value = null
    try {
      const page = await getKardex(
        kardexWarehouseId.value,
        kardexProductId.value,
        PAGE_SIZE,
        cursor,
      )
      if (request !== kardexRequest) return
      for (const row of page.data) {
        if (!kardexById.value[row.id]) kardexIds.value.push(row.id)
        kardexById.value[row.id] = row
      }
      kardexNextCursor.value = page.nextCursor
      moreKardexStatus.value = 'success'
    } catch (err) {
      if (request !== kardexRequest) return
      moreKardexError.value = toApiError(err).message
      moreKardexStatus.value = 'error'
    }
  }

  async function loadShrinkage(filters: ShrinkageFilters): Promise<void> {
    const request = ++shrinkageRequest
    shrinkageStatus.value = 'loading'
    shrinkageError.value = null
    try {
      const report = await getShrinkageReport(filters)
      if (request !== shrinkageRequest) return
      shrinkage.value = report
      shrinkageStatus.value = 'success'
    } catch (err) {
      if (request !== shrinkageRequest) return
      shrinkageError.value = toApiError(err).message
      shrinkageStatus.value = 'error'
    }
  }

  async function loadInTransit(warehouseId: string): Promise<void> {
    const request = ++inTransitRequest
    inTransitStatus.value = 'loading'
    inTransitError.value = null
    try {
      const report = await getInTransitReport(warehouseId)
      if (request !== inTransitRequest) return
      inTransit.value = report
      inTransitStatus.value = 'success'
    } catch (err) {
      if (request !== inTransitRequest) return
      inTransitError.value = toApiError(err).message
      inTransitStatus.value = 'error'
    }
  }

  /** Descarta las respuestas en vuelo (lo usa el plugin que vacía los stores al cerrar sesión). */
  function cancelPending(): void {
    kardexRequest++
    shrinkageRequest++
    inTransitRequest++
  }

  return {
    kardexWarehouseId,
    kardexProductId,
    kardex,
    kardexWarehouse,
    kardexProduct,
    hasMoreKardex,
    kardexStatus,
    kardexError,
    moreKardexStatus,
    moreKardexError,
    loadKardex,
    loadMoreKardex,
    shrinkage,
    shrinkageStatus,
    shrinkageError,
    inTransit,
    inTransitStatus,
    inTransitError,
    loadShrinkage,
    loadInTransit,
    cancelPending,
  }
})
