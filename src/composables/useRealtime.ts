import { onScopeDispose, watch } from 'vue'
import { createTicket } from '@/api/realtime'
import { parseRealtimeEvent, realtimeUrl, reconnectDelay } from '@/realtime'
import { useAuthStore } from '@/stores/auth'
import { useRealtimeStore } from '@/stores/realtime'
import type { RealtimeScreen } from '@/types/realtime'

/**
 * Mantiene abierto el WebSocket mientras haya sesión. Se usa una sola vez, en el layout principal.
 *
 * - Al iniciar sesión pide un ticket (`POST /api/realtime/ticket`) y abre el WebSocket del mismo
 *   origen con él. El access token nunca va en la URL.
 * - Si la conexión se corta, reintenta con espera creciente (1 s, 2 s, 4 s... hasta 30 s) y pide un
 *   ticket nuevo en cada intento (cada ticket sirve una sola vez). Al reconectar vuelve a pedir lo
 *   que está en pantalla, por si se perdió algún evento.
 * - Al cerrar o perder la sesión cierra la conexión y deja de reintentar.
 *
 * Sin conexión en vivo la aplicación sigue funcionando igual: solo deja de actualizarse sola.
 *
 * @param currentScreen qué hay en pantalla, para que los eventos recarguen solo eso.
 */
export function useRealtime(currentScreen: () => RealtimeScreen): void {
  const auth = useAuthStore()
  const realtime = useRealtimeStore()

  let socket: WebSocket | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let attempt = 0
  let active = false
  /** Ya hubo una conexión abierta: la siguiente que se abra es una reconexión. */
  let connectedBefore = false
  /** Sube al detenerse: un ticket que llega después de cerrar sesión se descarta. */
  let generation = 0

  async function connect(): Promise<void> {
    const started = generation
    realtime.setStatus('connecting')
    let ticket: string
    try {
      ticket = (await createTicket()).ticket
    } catch {
      // Sin red o servidor dormido: se reintenta. Si la sesión venció, el interceptor de http la
      // cierra y el `watch` de abajo detiene todo.
      if (started === generation) scheduleReconnect()
      return
    }
    if (started !== generation) return

    const ws = new WebSocket(realtimeUrl(ticket, window.location))
    socket = ws
    ws.onopen = () => {
      attempt = 0
      realtime.setStatus('connected')
      if (connectedBefore) void realtime.resync(currentScreen())
      connectedBefore = true
    }
    ws.onmessage = (message: MessageEvent<unknown>) => {
      if (typeof message.data !== 'string') return
      const event = parseRealtimeEvent(message.data)
      if (event) void realtime.handleEvent(event, currentScreen())
    }
    ws.onclose = () => {
      // Un socket viejo (ya reemplazado o cerrado a propósito) no reprograma nada
      if (socket !== ws) return
      socket = null
      if (active) scheduleReconnect()
    }
  }

  function scheduleReconnect(): void {
    realtime.setStatus('disconnected')
    const delay = reconnectDelay(attempt)
    attempt++
    retryTimer = setTimeout(() => {
      retryTimer = null
      void connect()
    }, delay)
  }

  function start(): void {
    if (active) return
    active = true
    attempt = 0
    connectedBefore = false
    void connect()
  }

  function stop(): void {
    active = false
    generation++
    if (retryTimer !== null) clearTimeout(retryTimer)
    retryTimer = null
    const current = socket
    socket = null
    current?.close()
    realtime.setStatus('disconnected')
  }

  watch(
    () => auth.isAuthenticated,
    (signedIn) => (signedIn ? start() : stop()),
    { immediate: true },
  )
  onScopeDispose(stop)
}
