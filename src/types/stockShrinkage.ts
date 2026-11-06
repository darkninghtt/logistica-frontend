import type { ApiSchema } from './contract'

/** Motivos de una merma de bodega, como los acepta la API. */
export type ShrinkageReason = ApiSchema<'StockShrinkageInput'>['reason']

/** Cuerpo de POST /api/stock/shrinkage. */
export type StockShrinkageInput = ApiSchema<'StockShrinkageInput'>

/** Respuesta de POST /api/stock/shrinkage. Los costos no llegan al OPERATOR. */
export type StockShrinkageResult = ApiSchema<'StockEntryResponse'>
