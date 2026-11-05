import type { TransferStatus } from './transfer'

/**
 * Eventos que llegan por el WebSocket (`{ type, payload }`). No traen costos: avisan qué cambió y
 * el cliente vuelve a pedir el detalle por la API, que ya filtra por rol.
 */
export type RealtimeEvent =
  | {
      type: 'transfer.updated'
      payload: {
        transferId: string
        status: TransferStatus
        originWarehouseId: string
        destinationWarehouseId: string
      }
    }
  | {
      type: 'stock.changed'
      payload: { warehouseId: string; productIds: string[] }
    }

/** Respuesta de POST /api/realtime/ticket: ticket de un solo uso que vence en `expiresIn` segundos. */
export interface RealtimeTicket {
  ticket: string
  expiresIn: number
}

/** Estado de la conexión en vivo, para el indicador de la barra superior. */
export type RealtimeStatus = 'disconnected' | 'connecting' | 'connected'

/** Lo que hay en pantalla, para saber qué volver a pedir cuando llega un evento. */
export interface RealtimeScreen {
  /** Nombre de la ruta actual (`transfers`, `transfer-detail`, `stock`...), o null. */
  name: string | null
  /** Id del traspaso abierto, si la pantalla es su detalle. */
  transferId: string | null
}

/** Aviso visible para el usuario. `to` es la ruta a la que lleva el enlace, si tiene. */
export interface RealtimeNotice {
  id: number
  text: string
  to: string | null
}
