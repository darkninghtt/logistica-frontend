import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getSummary } from '@/api/reports'
import { toApiError } from '@/api/http'
import { useTtlCache } from '@/composables/useTtlCache'
import type { LoadStatus } from '@/types/api'
import type { DashboardSummary } from '@/types/report'

/**
 * Store del dashboard: el resumen de GET /api/reports/summary (es un solo objeto, no una lista,
 * así que no se normaliza). Con caché TTL y recarga silenciosa cuando llega un aviso en vivo.
 */
export const useDashboardStore = defineStore('dashboard', () => {
  const summary = ref<DashboardSummary | null>(null)
  const status = ref<LoadStatus>('idle')
  const error = ref<string | null>(null)
  const cache = useTtlCache()
  let request = 0

  /**
   * Carga el resumen. Con `silent` (recarga por un aviso en vivo) se sigue viendo el que había
   * mientras llega la respuesta y, si falla, se queda como estaba.
   */
  async function fetchSummary({
    force = false,
    silent = false,
  }: { force?: boolean; silent?: boolean } = {}): Promise<void> {
    if (!force && cache.isFresh()) return
    const current = ++request
    if (!silent) {
      status.value = 'loading'
      error.value = null
    }
    try {
      const result = await getSummary()
      if (current !== request) return
      summary.value = result
      cache.markFetched()
      status.value = 'success'
      error.value = null
    } catch (err) {
      if (current !== request) return
      cache.invalidate()
      if (silent && status.value === 'success') return
      error.value = toApiError(err).message
      status.value = 'error'
    }
  }

  /**
   * Cambió un traspaso o el stock (aviso en vivo): descarta la caché y, si el dashboard está en
   * pantalla, lo vuelve a pedir sin parpadeo.
   */
  async function refreshAfterEvent(onScreen: boolean): Promise<void> {
    cache.invalidate()
    if (onScreen) await fetchSummary({ force: true, silent: true })
  }

  /** Descarta la respuesta en vuelo al cerrar la sesión (ver el plugin `resetOnSessionEnd`). */
  function cancelPending(): void {
    request++
  }

  return {
    summary,
    status,
    error,
    lastFetchedAt: cache.lastFetchedAt,
    fetchSummary,
    refreshAfterEvent,
    cancelPending,
  }
})
