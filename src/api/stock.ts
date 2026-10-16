import type { Page } from '@/types/api'
import type { StockLevelItem, StockMovementItem } from '@/types/stock'
import { http } from './http'

export async function listStockLevels(
  warehouseId: string,
  page: number,
  pageSize: number,
): Promise<Page<StockLevelItem>> {
  const res = await http.get<Page<StockLevelItem>>('/stock', {
    params: { warehouseId, page, pageSize },
  })
  return res.data
}

/** Si `productId` es undefined, axios omite el parámetro y el historial es de toda la bodega. */
export async function listStockMovements(
  warehouseId: string,
  productId: string | undefined,
  page: number,
  pageSize: number,
): Promise<Page<StockMovementItem>> {
  const res = await http.get<Page<StockMovementItem>>('/stock/movements', {
    params: { warehouseId, productId, page, pageSize },
  })
  return res.data
}
