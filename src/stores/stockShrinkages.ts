import { ref } from 'vue'
import { defineStore } from 'pinia'
import { listProducts } from '@/api/products'
import { createStockShrinkage } from '@/api/stockShrinkages'
import { listWarehouses } from '@/api/warehouses'
import { toApiError } from '@/api/http'
import { useTtlCache } from '@/composables/useTtlCache'
import { useStockStore } from './stock'
import type { LoadStatus } from '@/types/api'
import type { Product } from '@/types/product'
import type { StockShrinkageInput, StockShrinkageResult } from '@/types/stockShrinkage'
import type { Warehouse } from '@/types/warehouse'

/** Máximo que admite la API por página: las listas del formulario muestran hasta tantas opciones. */
const OPTIONS_PAGE_SIZE = 100

/**
 * Store del formulario de mermas: las opciones de bodega (la API solo devuelve las asignadas al
 * jefe y al operario) y de producto, y el registro de la merma.
 */
export const useStockShrinkagesStore = defineStore('stockShrinkages', () => {
  const warehouses = ref<Warehouse[]>([])
  const products = ref<Product[]>([])
  const optionsStatus = ref<LoadStatus>('idle')
  const optionsError = ref<string | null>(null)
  const optionsCache = useTtlCache()

  const saving = ref(false)
  const saveError = ref<string | null>(null)
  const lastShrinkage = ref<StockShrinkageResult | null>(null)

  /** Carga las opciones del formulario. Si siguen vigentes (TTL) no las vuelve a pedir, salvo con `force`. */
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

  /** Registra la merma. Devuelve false y deja `saveError` si falla; si va bien, guarda `lastShrinkage`. */
  async function register(input: StockShrinkageInput): Promise<boolean> {
    saving.value = true
    saveError.value = null
    try {
      lastShrinkage.value = await createStockShrinkage(input)
      // La merma cambió existencias e historial: la consulta de stock debe volver a pedirlos.
      useStockStore().invalidate()
      return true
    } catch (err) {
      saveError.value = toApiError(err).message
      return false
    } finally {
      saving.value = false
    }
  }

  /** Descarta las opciones del formulario: tras crear o editar una bodega o un producto. */
  function invalidateOptions(): void {
    optionsCache.invalidate()
  }

  function clearResult(): void {
    lastShrinkage.value = null
    saveError.value = null
  }

  return {
    warehouses,
    products,
    optionsStatus,
    optionsError,
    optionsFetchedAt: optionsCache.lastFetchedAt,
    saving,
    saveError,
    lastShrinkage,
    loadOptions,
    register,
    invalidateOptions,
    clearResult,
  }
})
