import { TRANSFER_STATUSES } from './transfers'
import type { RealtimeEvent, RealtimeScreen } from './types/realtime'
import type { TransferStatus } from './types/transfer'

/** Ruta del WebSocket en el mismo origen que la API. */
export const REALTIME_PATH = '/api/realtime'

/** Espera antes del primer reintento de conexión y tope de la espera creciente. */
export const RECONNECT_BASE_MS = 1000
export const RECONNECT_MAX_MS = 30_000

/**
 * Espera antes del reintento número `attempt` (0, 1, 2...): 1 s, 2 s, 4 s... hasta 30 s. Así un
 * servidor caído no recibe un intento por segundo de cada pestaña abierta.
 */
export function reconnectDelay(attempt: number): number {
  return Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS)
}

/**
 * URL del WebSocket en el mismo origen de la página: `wss` si la página va por https (Render),
 * `ws` en local. El ticket va en la URL porque el navegador no deja enviar `Authorization` al
 * abrir un WebSocket; por eso es de un solo uso y vence en 30 s (nunca se pone el access token).
 */
export function realtimeUrl(ticket: string, location: Pick<Location, 'protocol' | 'host'>): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${location.host}${REALTIME_PATH}?ticket=${encodeURIComponent(ticket)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTransferStatus(value: unknown): value is TransferStatus {
  return TRANSFER_STATUSES.some((status) => status === value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}

/**
 * Interpreta un mensaje del WebSocket. Devuelve null si no es JSON o no tiene la forma de un evento
 * conocido: un mensaje mal formado se ignora en lugar de romper la aplicación.
 */
export function parseRealtimeEvent(raw: string): RealtimeEvent | null {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(data) || !isRecord(data.payload)) return null
  const payload = data.payload

  if (data.type === 'transfer.updated') {
    const { transferId, status, originWarehouseId, destinationWarehouseId } = payload
    if (
      !isNonEmptyString(transferId) ||
      !isTransferStatus(status) ||
      !isNonEmptyString(originWarehouseId) ||
      !isNonEmptyString(destinationWarehouseId)
    ) {
      return null
    }
    return {
      type: 'transfer.updated',
      payload: { transferId, status, originWarehouseId, destinationWarehouseId },
    }
  }

  if (data.type === 'stock.changed') {
    const { warehouseId, productIds } = payload
    if (!isNonEmptyString(warehouseId) || !Array.isArray(productIds)) return null
    if (!productIds.every(isNonEmptyString)) return null
    return { type: 'stock.changed', payload: { warehouseId, productIds } }
  }

  return null
}

/** Lo que hay en pantalla a partir de la ruta actual (nombre y parámetro `id`). */
export function screenFromRoute(
  name: string | symbol | null | undefined,
  id: string | string[] | undefined,
): RealtimeScreen {
  const routeName = typeof name === 'string' ? name : null
  const transferId = Array.isArray(id) ? (id[0] ?? null) : (id ?? null)
  return { name: routeName, transferId: routeName === 'transfer-detail' ? transferId : null }
}
