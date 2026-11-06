import type { ApiSchema } from './contract'

/** Cuerpo de POST /api/stock/entries. El costo viaja como string (nunca como número). */
export type StockEntryInput = ApiSchema<'StockEntryInput'>

/** Existencias de un producto en una bodega. Los costos no llegan al OPERATOR. */
export type StockLevel = ApiSchema<'StockLevel'>

/** Tipos de movimiento del libro (ver CLAUDE.md, sección 5). */
export type MovementType = ApiSchema<'StockMovement'>['type']

/** Fila del libro de movimientos, con el saldo y el costo promedio resultantes (sin costos para el OPERATOR). */
export type StockMovement = ApiSchema<'StockMovement'>

/** Respuesta de POST /api/stock/entries. */
export type StockEntryResult = ApiSchema<'StockEntryResponse'>
