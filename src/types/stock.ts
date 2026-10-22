import type { StockLevel, StockMovement } from './stockEntry'

/**
 * Existencias con los datos del producto (GET /api/stock). Los costos viajan como string y son
 * opcionales: la API no los envía al OPERATOR.
 */
export interface StockLevelItem
  extends
    Omit<StockLevel, 'avgCost' | 'totalValue'>,
    Partial<Pick<StockLevel, 'avgCost' | 'totalValue'>> {
  productSku: string
  productName: string
  productUnit: string
}

/** Movimiento del libro con los datos del producto (GET /api/stock/movements). Sin costos para el OPERATOR. */
export interface StockMovementItem
  extends
    Omit<StockMovement, 'unitCost' | 'balanceAvgCost'>,
    Partial<Pick<StockMovement, 'unitCost' | 'balanceAvgCost'>> {
  productSku: string
  productName: string
}
