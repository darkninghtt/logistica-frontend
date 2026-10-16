import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import * as api from '@/api/warehouses'
import { toApiError } from '@/api/http'
import type { Warehouse, WarehouseInput } from '@/types/warehouse'

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error'

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

  const items = computed<Warehouse[]>(() =>
    ids.value.flatMap((id) => {
      const warehouse = byId.value[id]
      return warehouse ? [warehouse] : []
    }),
  )
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

  async function fetchPage(target: number = page.value): Promise<void> {
    status.value = 'loading'
    error.value = null
    try {
      const result = await api.listWarehouses(target, pageSize.value)
      byId.value = { ...byId.value, ...Object.fromEntries(result.data.map((w) => [w.id, w])) }
      ids.value = result.data.map((w) => w.id)
      page.value = result.page
      total.value = result.total
      status.value = 'success'
    } catch (err) {
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
    await fetchPage()
    return true
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
    items,
    totalPages,
    fetchPage,
    save,
    clearSaveError,
  }
})
