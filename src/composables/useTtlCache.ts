import { ref, type Ref } from 'vue'

/** Tiempo que un dato cargado se considera vigente antes de volver a pedirlo al servidor. */
export const CACHE_TTL_MS = 60_000

export interface TtlCache {
  /** Momento (ms) de la última carga correcta, o null si no hay datos vigentes. */
  lastFetchedAt: Ref<number | null>
  /** True si los datos se cargaron con esta misma `key` hace menos de `CACHE_TTL_MS`. */
  isFresh: (key?: string) => boolean
  /** Anota una carga correcta de la consulta `key`. */
  markFetched: (key?: string) => void
  /** Descarta los datos: la próxima carga irá al servidor. */
  invalidate: () => void
}

/**
 * Caché con TTL para un store. Guarda la hora de la última carga y la consulta a la que
 * corresponde (por ejemplo, la página o la bodega), así que solo recuerda la última consulta:
 * pedir otra distinta siempre va al servidor.
 *
 * Patrón de uso en un store:
 *   - al empezar `fetch`: `if (!force && cache.isFresh(key)) return`
 *   - al cargar bien: `cache.markFetched(key)`; al fallar: `cache.invalidate()`
 *   - al mutar (crear, editar, despachar...): `cache.invalidate()` en los stores afectados.
 */
export function useTtlCache(ttlMs: number = CACHE_TTL_MS): TtlCache {
  const lastFetchedAt = ref<number | null>(null)
  let fetchedKey = ''

  function isFresh(key = ''): boolean {
    return (
      lastFetchedAt.value !== null && fetchedKey === key && Date.now() - lastFetchedAt.value < ttlMs
    )
  }

  function markFetched(key = ''): void {
    fetchedKey = key
    lastFetchedAt.value = Date.now()
  }

  function invalidate(): void {
    lastFetchedAt.value = null
  }

  return { lastFetchedAt, isFresh, markFetched, invalidate }
}
