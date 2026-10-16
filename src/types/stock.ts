/** Existencias de un producto en una bodega (GET /api/stock). Los costos viajan como string. */
export interface StockLevelItem {
  productId: string
  warehouseId: string
  quantity: number
  avgCost: string
  totalValue: string
  productSku: string
  productName: string
  productUnit: string
}

/** Fila del libro de movimientos con el saldo y el costo promedio resultantes (GET /api/stock/movements). */
export interface StockMovementItem {
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
  productSku: string
  productName: string
}
