/** Cuerpo de POST /api/stock/entries. El costo viaja como string (nunca como número). */
export interface StockEntryInput {
  warehouseId: string
  productId: string
  quantity: number
  unitCost: string
}

/** Existencias de un producto en una bodega, tal como las devuelve la API. */
export interface StockLevel {
  productId: string
  warehouseId: string
  quantity: number
  avgCost: string
  totalValue: string
}

/** Tipos de movimiento del libro (ver CLAUDE.md, sección 5). */
export type MovementType =
  'ENTRY' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'SHRINKAGE' | 'TRANSIT_SHRINKAGE' | 'ADJUSTMENT_IN'

/** Fila del libro de movimientos, con el saldo y el costo promedio resultantes. */
export interface StockMovement {
  id: string
  productId: string
  warehouseId: string
  type: MovementType
  quantity: number
  unitCost: string
  balanceQty: number
  balanceAvgCost: string
  /** Motivo (mermas y ajustes); null si el movimiento no lo lleva. */
  reason: string | null
  /** Traspaso que originó el movimiento; null si no viene de uno. */
  transferId: string | null
  createdBy: string
  createdAt: string
}

/** Respuesta de POST /api/stock/entries. */
export interface StockEntryResult {
  movement: StockMovement
  stockLevel: StockLevel
}
