import type { CursorPage } from './api'
import type { MovementType } from './stockEntry'

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
