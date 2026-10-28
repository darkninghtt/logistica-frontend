import type { StockLevel, StockMovement } from './stockEntry'

/** Motivos de una merma de bodega, como los acepta la API. */
export type ShrinkageReason = 'DAMAGE' | 'EXPIRED' | 'THEFT' | 'COUNT_ADJUSTMENT'

/** Cuerpo de POST /api/stock/shrinkage. */
export interface StockShrinkageInput {
  warehouseId: string
  productId: string
  quantity: number
  reason: ShrinkageReason
  note?: string
}

/** Respuesta de POST /api/stock/shrinkage. Los costos son opcionales: la API no los envía al OPERATOR. */
export interface StockShrinkageResult {
  movement: Omit<StockMovement, 'unitCost' | 'balanceAvgCost'> &
    Partial<Pick<StockMovement, 'unitCost' | 'balanceAvgCost'>>
  stockLevel: Omit<StockLevel, 'avgCost' | 'totalValue'> &
    Partial<Pick<StockLevel, 'avgCost' | 'totalValue'>>
}
