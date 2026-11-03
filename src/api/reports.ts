import type { KardexPage } from '@/types/report'
import { http } from './http'

/** Kardex de un producto en una bodega, en orden cronológico. Sin `cursor`, la primera página. */
export async function getKardex(
  warehouseId: string,
  productId: string,
  limit: number,
  cursor?: string,
): Promise<KardexPage> {
  const res = await http.get<KardexPage>('/reports/kardex', {
    params: { warehouseId, productId, limit, cursor },
  })
  return res.data
}
