import type { ApiSchema } from './contract'

/** Existencias con los datos del producto (GET /api/stock). Sin costos para el OPERATOR. */
export type StockLevelItem = ApiSchema<'StockLevelItem'>

/** Movimiento del libro con los datos del producto (GET /api/stock/movements). Sin costos para el OPERATOR. */
export type StockMovementItem = ApiSchema<'StockMovementItem'>

/** GET /api/stock (paginado por número de página). */
export type StockLevelPage = ApiSchema<'StockLevelPage'>

/** GET /api/stock/movements (paginado por cursor). */
export type StockMovementPage = ApiSchema<'StockMovementPage'>
