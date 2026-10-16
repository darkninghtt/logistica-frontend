import type { StockLevel, StockMovement } from './stockEntry'

/** Existencias con los datos del producto (GET /api/stock). Los costos viajan como string. */
export interface StockLevelItem extends StockLevel {
  productSku: string
  productName: string
  productUnit: string
}

/** Movimiento del libro con los datos del producto (GET /api/stock/movements). */
export interface StockMovementItem extends StockMovement {
  productSku: string
  productName: string
}
