import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import * as api from '@/api/warehouses'
import { toApiError } from '@/api/http'
import { useTtlCache } from '@/composables/useTtlCache'
import { useStockEntriesStore } from './stockEntries'
import { useStockShrinkagesStore } from './stockShrinkages'
import { useTransfersStore } from './transfers'
import { useStockStore } from './stock'
import type { LoadStatus } from '@/types/api'
import type { Warehouse, WarehouseInput } from '@/types/warehouse'

/** Store del dominio "bodegas": datos normalizados (`byId` + `ids` de la página actual). */
export const useWarehousesStore = defineStore('warehouses', () => {
  const byId = ref<Record<string, Warehouse>>({})
  const ids = ref<string[]>([])
  const page = ref(1)
  const pageSize = ref(10)
  const total = ref(0)
  const status = ref<LoadStatus>('idle')
  const error = ref<string | null>(null)
  const saving = ref(false)
  const saveError = ref<string | null>(null)
  const cache = useTtlCache()

  const items = computed<Warehouse[]>(() =>
    ids.value.flatMap((id) => {
      const warehouse = byId.value[id]
      return warehouse ? [warehouse] : []
    }),
  )
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

  /** Carga una página. Si ya está cargada y vigente (TTL) no vuelve a pedirla, salvo con `force`. */
  async function fetchPage(
    target: number = page.value,
    { force = false }: { force?: boolean } = {},
  ): Promise<void> {
    if (!force && cache.isFresh(String(target))) return
    status.value = 'loading'
    error.value = null
    try {
      const result = await api.listWarehouses(target, pageSize.value)
      byId.value = { ...byId.value, ...Object.fromEntries(result.data.map((w) => [w.id, w])) }
      ids.value = result.data.map((w) => w.id)
      page.value = result.page
      total.value = result.total
      cache.markFetched(String(result.page))
      status.value = 'success'
    } catch (err) {
      cache.invalidate()
      error.value = toApiError(err).message
      status.value = 'error'
    }
  }

  /** Guarda (crea o edita) y recarga la página. Devuelve false y deja `saveError` si falla. */
  async function save(input: WarehouseInput, id?: string): Promise<boolean> {
    saving.value = true
    saveError.value = null
    try {
      if (id) await api.updateWarehouse(id, input)
      else await api.createWarehouse(input)
    } catch (err) {
      saveError.value = toApiError(err).message
      return false
    } finally {
      saving.value = false
    }
    invalidate()
    await fetchPage(page.value, { force: true })
    return true
  }

  /**
   * Descarta la caché de este store y de los que guardan copias de estas opciones
   * (los selectores de stock, de entradas y de mermas), para que la próxima carga vaya al servidor.
   */
  function invalidate(): void {
    cache.invalidate()
    useStockStore().invalidateOptions()
    useStockEntriesStore().invalidateOptions()
    useStockShrinkagesStore().invalidateOptions()
    useTransfersStore().invalidateOptions()
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
    saving,
    saveError,
    lastFetchedAt: cache.lastFetchedAt,
    items,
    totalPages,
    fetchPage,
    save,
    invalidate,
    clearSaveError,
  }
})
