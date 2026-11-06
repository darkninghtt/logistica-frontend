import type { ApiSchema } from './contract'

/** Fila del kardex valorizado (GET /api/reports/kardex). Costos y valores viajan como string. */
export type KardexRow = ApiSchema<'KardexRow'>

export type KardexPage = ApiSchema<'KardexPage'>

export type ExportFormat = 'csv' | 'pdf'

/** Reporte de mermas (GET /api/reports/shrinkage), agrupado por bodega, producto, tipo y motivo. */
export type ShrinkageReport = ApiSchema<'ShrinkageReport'>

export type ShrinkageReportRow = ShrinkageReport['data'][number]

/** Filtros del reporte de mermas; las fechas son AAAA-MM-DD (vacío = sin límite). */
export interface ShrinkageFilters {
  warehouseId: string
  from: string
  to: string
}

/** Traspasos en tránsito (GET /api/reports/in-transit), valorizados al costo congelado. */
export type InTransitReport = ApiSchema<'InTransitReport'>

export type InTransitReportRow = InTransitReport['data'][number]

/** Respuesta de GET /api/reports/summary, ya filtrada por las bodegas de quien la pide. */
export type DashboardSummary = ApiSchema<'DashboardSummary'>

/** Valor del inventario de una bodega (cantidad × costo promedio de sus existencias). */
export type WarehouseInventoryValue = DashboardSummary['inventoryValueByWarehouse'][number]
