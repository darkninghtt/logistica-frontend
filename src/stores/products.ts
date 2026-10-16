import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import * as api from '@/api/products'
import { toApiError } from '@/api/http'
import type { LoadStatus } from '@/types/api'
import type { Product, ProductInput } from '@/types/product'

/** Store del dominio "productos": datos normalizados (`byId` + `ids` de la página actual). */
export const useProductsStore = defineStore('products', () => {
  const byId = ref<Record<string, Product>>({})
  const ids = ref<string[]>([])
  const page = ref(1)
  const pageSize = ref(10)
  const total = ref(0)
  const status = ref<LoadStatus>('idle')
  const error = ref<string | null>(null)
  const saving = ref(false)
  const saveError = ref<string | null>(null)

  const items = computed<Product[]>(() =>
    ids.value.flatMap((id) => {
      const product = byId.value[id]
      return product ? [product] : []
    }),
  )
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

  async function fetchPage(target: number = page.value): Promise<void> {
    status.value = 'loading'
    error.value = null
    try {
      const result = await api.listProducts(target, pageSize.value)
      byId.value = { ...byId.value, ...Object.fromEntries(result.data.map((p) => [p.id, p])) }
      ids.value = result.data.map((p) => p.id)
      page.value = result.page
      total.value = result.total
      status.value = 'success'
    } catch (err) {
      error.value = toApiError(err).message
      status.value = 'error'
    }
  }

  /** Guarda (crea o edita) y recarga la página. Devuelve false y deja `saveError` si falla. */
  async function save(input: ProductInput, id?: string): Promise<boolean> {
    saving.value = true
    saveError.value = null
    try {
      if (id) await api.updateProduct(id, input)
      else await api.createProduct(input)
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
