import type { InTransitReport, KardexPage, ShrinkageFilters, ShrinkageReport } from '@/types/report'
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

/** Los filtros vacíos se envían como undefined para que axios los omita. */
function shrinkageParams(filters: ShrinkageFilters): Record<string, string | undefined> {
  return {
    warehouseId: filters.warehouseId || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
  }
}

export async function getShrinkageReport(filters: ShrinkageFilters): Promise<ShrinkageReport> {
  const res = await http.get<ShrinkageReport>('/reports/shrinkage', {
    params: shrinkageParams(filters),
  })
  return res.data
}

/** Sin bodega, los traspasos de todas las bodegas visibles. */
export async function getInTransitReport(warehouseId?: string): Promise<InTransitReport> {
  const res = await http.get<InTransitReport>('/reports/in-transit', {
    params: { warehouseId: warehouseId || undefined },
  })
  return res.data
}
