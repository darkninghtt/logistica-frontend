import type { ApiSchema } from './contract'

/** Estados de un traspaso: DRAFT → IN_TRANSIT → RECEIVED | DISCREPANCY → RESOLVED, y CANCELLED desde DRAFT. */
export type TransferStatus = ApiSchema<'TransferSummary'>['status']

/** Bodega tal como viaja dentro de un traspaso. */
export type WarehouseRef = ApiSchema<'WarehouseRef'>

/** Fila del listado (GET /api/transfers). */
export type TransferSummary = ApiSchema<'TransferSummary'>

/** Ítem del detalle. `unitCost` no llega al OPERATOR y es null mientras el traspaso es borrador. */
export type TransferItem = ApiSchema<'TransferItem'>

/** Una línea de la línea de eventos: quién cambió el estado, cuándo y por qué. */
export type TransferEvent = ApiSchema<'TransferEvent'>

/** Detalle (GET /api/transfers/:id y respuesta de crear y de cada transición). */
export type TransferDetail = ApiSchema<'TransferDetail'>

/** Cuerpo de POST /api/transfers. */
export type TransferInput = ApiSchema<'TransferCreateInput'>

/** Cuerpo de POST /api/transfers/:id/receive: la cantidad recibida de todos los ítems. */
export type TransferReceiveInput = ApiSchema<'TransferReceiveInput'>

/** Filtros del listado; cadena vacía = sin filtro. */
export interface TransferFilters {
  status: TransferStatus | ''
  warehouseId: string
}

/** GET /api/transfers. */
export type TransferPage = ApiSchema<'TransferPage'>
