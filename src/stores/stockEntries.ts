import { ref } from 'vue'
import { defineStore } from 'pinia'
import { listProducts } from '@/api/products'
import { createStockEntry } from '@/api/stockEntries'
import { listWarehouses } from '@/api/warehouses'
import { toApiError } from '@/api/http'
import type { LoadStatus } from '@/types/api'
import type { Product } from '@/types/product'
import type { StockEntryInput, StockEntryResult } from '@/types/stockEntry'
import type { Warehouse } from '@/types/warehouse'

/** Máximo que admite la API por página: las listas del formulario muestran hasta tantas opciones. */
const OPTIONS_PAGE_SIZE = 100

/**
 * Store del formulario de entrada de stock: las opciones de bodega y producto (aparte de los
 * stores de bodegas y productos, para no alterar su paginación) y el registro de la entrada.
 */
export const useStockEntriesStore = defineStore('stockEntries', () => {
  const warehouses = ref<Warehouse[]>([])
  const products = ref<Product[]>([])
  const optionsStatus = ref<LoadStatus>('idle')
  const optionsError = ref<string | null>(null)

  const saving = ref(false)
  const saveError = ref<string | null>(null)
  const lastEntry = ref<StockEntryResult | null>(null)

  async function loadOptions(): Promise<void> {
    optionsStatus.value = 'loading'
    optionsError.value = null
    try {
      const [warehousePage, productPage] = await Promise.all([
        listWarehouses(1, OPTIONS_PAGE_SIZE),
        listProducts(1, OPTIONS_PAGE_SIZE),
      ])
      warehouses.value = warehousePage.data
      products.value = productPage.data
      optionsStatus.value = 'success'
    } catch (err) {
      optionsError.value = toApiError(err).message
      optionsStatus.value = 'error'
    }
  }

  /** Registra la entrada. Devuelve false y deja `saveError` si falla; si va bien, guarda `lastEntry`. */
  async function register(input: StockEntryInput): Promise<boolean> {
    saving.value = true
    saveError.value = null
    try {
      lastEntry.value = await createStockEntry(input)
      return true
    } catch (err) {
      saveError.value = toApiError(err).message
      return false
    } finally {
      saving.value = false
    }
  }

  function clearResult(): void {
    lastEntry.value = null
    saveError.value = null
  }

  return {
    warehouses,
    products,
    optionsStatus,
    optionsError,
    saving,
    saveError,
    lastEntry,
    loadOptions,
    register,
    clearResult,
  }
})
