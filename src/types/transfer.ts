/** Estados de un traspaso: DRAFT → IN_TRANSIT → RECEIVED | DISCREPANCY → RESOLVED, y CANCELLED desde DRAFT. */
export type TransferStatus =
  'DRAFT' | 'IN_TRANSIT' | 'RECEIVED' | 'DISCREPANCY' | 'RESOLVED' | 'CANCELLED'

/** Bodega tal como viaja dentro de un traspaso. */
export interface WarehouseRef {
  id: string
  code: string
  name: string
}

/** Fila del listado (GET /api/transfers). */
export interface TransferSummary {
  id: string
  status: TransferStatus
  origin: WarehouseRef
  destination: WarehouseRef
  itemCount: number
  createdAt: string
  updatedAt: string
}

/** Ítem del detalle. `unitCost` no llega al OPERATOR y es null mientras el traspaso es borrador. */
export interface TransferItem {
  productId: string
  productSku: string
  productName: string
  quantitySent: number
  /** null hasta que el destino declara la recepción. */
  quantityReceived: number | null
  unitCost?: string | null
}

/** Una línea de la línea de eventos: quién cambió el estado, cuándo y por qué. */
export interface TransferEvent {
  fromStatus: TransferStatus | null
  toStatus: TransferStatus
  actor: { id: string; name: string }
  reason: string | null
  createdAt: string
}

/** Detalle (GET /api/transfers/:id y respuesta de crear, cancelar y despachar). */
export interface TransferDetail {
  id: string
  status: TransferStatus
  origin: WarehouseRef
  destination: WarehouseRef
  note: string | null
  createdBy: string
  dispatchedBy: string | null
  dispatchedAt: string | null
  receivedBy: string | null
  receivedAt: string | null
  resolvedBy: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
  items: TransferItem[]
  events: TransferEvent[]
}

/** Cuerpo de POST /api/transfers. */
export interface TransferInput {
  originWarehouseId: string
  destinationWarehouseId: string
  items: { productId: string; quantity: number }[]
  note?: string
}

/** Cuerpo de POST /api/transfers/:id/receive: la cantidad recibida de todos los ítems. */
export interface TransferReceiveInput {
  items: { productId: string; receivedQuantity: number }[]
}

/** Filtros del listado; cadena vacía = sin filtro. */
export interface TransferFilters {
  status: TransferStatus | ''
  warehouseId: string
}
