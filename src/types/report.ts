import type { CursorPage } from './api'
import type { MovementType } from './stockEntry'
import type { TransferStatus } from './transfer'

/** Fila del kardex valorizado (GET /api/reports/kardex). Costos y valores viajan como string. */
export interface KardexRow {
  id: string
  createdAt: string
  type: MovementType
  /** Motivo del movimiento o, si no tiene, el id del traspaso que lo originó. */
  reference: string | null
  transferId: string | null
  /** Cantidad del movimiento en el libro (la merma en tránsito no es entrada ni salida). */
  quantity: number
  quantityIn: number
  quantityOut: number
  balanceQty: number
  unitCost: string
  balanceAvgCost: string
  balanceValue: string
}

export interface KardexPage extends CursorPage<KardexRow> {
  warehouse: { id: string; code: string; name: string }
  product: { id: string; sku: string; name: string; unit: string }
}

export type ExportFormat = 'csv' | 'pdf'

/** Fila del reporte de mermas (GET /api/reports/shrinkage), agrupada por bodega, producto, tipo y motivo. */
export interface ShrinkageReportRow {
  warehouseId: string
  warehouseCode: string
  warehouseName: string
  productId: string
  productSku: string
  productName: string
  type: 'SHRINKAGE' | 'TRANSIT_SHRINKAGE'
  /** Código del motivo de una merma de bodega; null en la merma en tránsito. */
  reason: string | null
  quantity: number
  value: string
}

export interface ShrinkageReport {
  data: ShrinkageReportRow[]
  totals: { quantity: number; value: string }
}

/** Filtros del reporte de mermas; las fechas son AAAA-MM-DD (vacío = sin límite). */
export interface ShrinkageFilters {
  warehouseId: string
  from: string
  to: string
}

/** Traspaso en tránsito (GET /api/reports/in-transit), valorizado al costo congelado. */
export interface InTransitReportRow {
  transferId: string
  originWarehouseId: string
  originCode: string
  originName: string
  destinationWarehouseId: string
  destinationCode: string
  destinationName: string
  dispatchedAt: string
  daysInTransit: number
  quantity: number
  value: string
}

export interface InTransitReport {
  data: InTransitReportRow[]
  totals: { transfers: number; quantity: number; value: string }
}

/** Valor del inventario de una bodega (cantidad × costo promedio de sus existencias). */
export interface WarehouseInventoryValue {
  warehouseId: string
  code: string
  name: string
  value: string
}

/** Respuesta de GET /api/reports/summary, ya filtrada por las bodegas de quien la pide. */
export interface DashboardSummary {
  inventoryValueByWarehouse: WarehouseInventoryValue[]
  transfersByStatus: Record<TransferStatus, number>
  shrinkageLast30Days: { quantity: number; value: string }
  /** Mercancía en tránsito al costo congelado al despachar. */
  inTransitValue: string
}
