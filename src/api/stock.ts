import type { StockLevelPage, StockMovementPage } from '@/types/stock'
import { http } from './http'

export async function listStockLevels(
  warehouseId: string,
  page: number,
  pageSize: number,
): Promise<StockLevelPage> {
  const res = await http.get<StockLevelPage>('/stock', {
    params: { warehouseId, page, pageSize },
  })
  return res.data
}

/**
 * Historial del más nuevo al más antiguo, paginado por cursor. Si `productId` o `cursor` son
 * undefined, axios omite el parámetro (toda la bodega, primera página).
 */
export async function listStockMovements(
  warehouseId: string,
  productId: string | undefined,
  limit: number,
  cursor?: string,
): Promise<StockMovementPage> {
  const res = await http.get<StockMovementPage>('/stock/movements', {
    params: { warehouseId, productId, limit, cursor },
  })
  return res.data
}
