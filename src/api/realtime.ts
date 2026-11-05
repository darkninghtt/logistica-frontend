import type { RealtimeTicket } from '@/types/realtime'
import { http } from './http'

/** Pide un ticket de un solo uso (vence en 30 s) para abrir el WebSocket. */
export async function createTicket(): Promise<RealtimeTicket> {
  const res = await http.post<RealtimeTicket>('/realtime/ticket')
  return res.data
}
