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

/** Fila del libro de movimientos, con el saldo y el costo promedio resultantes. */
export interface StockMovement {
  id: string
  productId: string
  warehouseId: string
  type: 'ENTRY'
  quantity: number
  unitCost: string
  balanceQty: number
  balanceAvgCost: string
  createdBy: string
  createdAt: string
}

/** Respuesta de POST /api/stock/entries. */
export interface StockEntryResult {
  movement: StockMovement
  stockLevel: StockLevel
}
