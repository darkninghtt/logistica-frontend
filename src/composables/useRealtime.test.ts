import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, type EffectScope } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import * as api from '@/api/realtime'
import { useAuthStore } from '@/stores/auth'
import { useRealtimeStore } from '@/stores/realtime'
import type { RealtimeScreen } from '@/types/realtime'
import { useRealtime } from './useRealtime'

vi.mock('@/api/realtime')

/** WebSocket simulado: guarda cada conexión abierta para manejarla desde la prueba. */
class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  onopen: (() => void) | null = null
  onmessage: ((message: { data: unknown }) => void) | null = null
  onclose: (() => void) | null = null
  closed = false

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this)
  }

  close(): void {
    this.closed = true
    this.onclose?.()
  }

  /** El servidor acepta la conexión. */
  open(): void {
    this.onopen?.()
  }

  /** Llega un mensaje del servidor. */
  receive(data: unknown): void {
    this.onmessage?.({ data })
  }

  /** La conexión se corta sin que el cliente la cierre (servidor reiniciado, red caída). */
  drop(): void {
    this.onclose?.()
  }
}

function lastSocket(): FakeWebSocket {
  const socket = FakeWebSocket.instances.at(-1)
  if (!socket) throw new Error('No se abrió ningún WebSocket')
  return socket
}

const screen: RealtimeScreen = { name: 'transfers', transferId: null }
let scope: EffectScope

function signIn(): void {
  useAuthStore().user = { id: 'u1', name: 'Jefe', email: 'j@b.co', role: 'WAREHOUSE_MANAGER' }
}

/** Monta el composable como lo hace el layout. */
function startRealtime(): void {
  scope = effectScope()
  scope.run(() => useRealtime(() => screen))
}

let ticketNumber = 0

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  vi.resetAllMocks()
  FakeWebSocket.instances = []
  vi.stubGlobal('WebSocket', FakeWebSocket)
  ticketNumber = 0
  vi.mocked(api.createTicket).mockImplementation(() =>
    Promise.resolve({ ticket: `t-${++ticketNumber}`, expiresIn: 30 }),
  )
})

afterEach(() => {
  scope.stop()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useRealtime', () => {
  it('sin sesión no pide ticket; tras el login conecta con un ticket del mismo origen', async () => {
    startRealtime()
    await flushPromises()
    expect(api.createTicket).not.toHaveBeenCalled()

    signIn()
    await flushPromises()

    expect(api.createTicket).toHaveBeenCalledTimes(1)
    expect(lastSocket().url).toBe(`ws://${window.location.host}/api/realtime?ticket=t-1`)
    expect(useRealtimeStore().status).toBe('connecting')

    lastSocket().open()
    expect(useRealtimeStore().status).toBe('connected')
  })

  it('al cortarse reconecta con espera creciente y un ticket nuevo, y recarga lo que está en pantalla', async () => {
    signIn()
    startRealtime()
    await flushPromises()
    const realtime = useRealtimeStore()
    const resync = vi.spyOn(realtime, 'resync').mockResolvedValue()
    lastSocket().open()
    expect(resync).not.toHaveBeenCalled()

    lastSocket().drop()
    expect(realtime.status).toBe('disconnected')
    await vi.advanceTimersByTimeAsync(999)
    expect(api.createTicket).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(api.createTicket).toHaveBeenCalledTimes(2)
    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(lastSocket().url).toContain('ticket=t-2')

    lastSocket().open()
    expect(realtime.status).toBe('connected')
    expect(resync).toHaveBeenCalledWith(screen)
  })

  it('si no consigue el ticket, reintenta a 1 s, luego a 2 s', async () => {
    vi.mocked(api.createTicket).mockRejectedValue(new Error('sin red'))
    signIn()
    startRealtime()
    await flushPromises()
    expect(api.createTicket).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1000)
    expect(api.createTicket).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1999)
    expect(api.createTicket).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(api.createTicket).toHaveBeenCalledTimes(3)
    expect(FakeWebSocket.instances).toHaveLength(0)
  })

  it('tras reconectar, la espera vuelve a empezar en 1 s', async () => {
    signIn()
    startRealtime()
    await flushPromises()
    vi.spyOn(useRealtimeStore(), 'resync').mockResolvedValue()
    lastSocket().drop()
    await vi.advanceTimersByTimeAsync(1000)
    lastSocket().open()

    lastSocket().drop()
    await vi.advanceTimersByTimeAsync(1000)
    expect(api.createTicket).toHaveBeenCalledTimes(3)
  })

  it('al cerrar sesión cierra la conexión y deja de reintentar', async () => {
    signIn()
    startRealtime()
    await flushPromises()
    const socket = lastSocket()
    socket.open()

    useAuthStore().clearSession()
    await flushPromises()

    expect(socket.closed).toBe(true)
    expect(useRealtimeStore().status).toBe('disconnected')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(api.createTicket).toHaveBeenCalledTimes(1)
    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it('un ticket que llega después de cerrar sesión no abre ninguna conexión', async () => {
    let deliver: (value: { ticket: string; expiresIn: number }) => void = () => undefined
    vi.mocked(api.createTicket).mockReturnValue(
      new Promise((resolve) => {
        deliver = resolve
      }),
    )
    signIn()
    startRealtime()
    await flushPromises()

    useAuthStore().clearSession()
    await flushPromises()
    deliver({ ticket: 'tarde', expiresIn: 30 })
    await flushPromises()

    expect(FakeWebSocket.instances).toHaveLength(0)
  })

  it('al desmontar el layout cierra la conexión', async () => {
    signIn()
    startRealtime()
    await flushPromises()
    const socket = lastSocket()
    socket.open()

    scope.stop()

    expect(socket.closed).toBe(true)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(api.createTicket).toHaveBeenCalledTimes(1)
  })

  it('pasa los eventos válidos al store e ignora los mensajes mal formados', async () => {
    signIn()
    startRealtime()
    await flushPromises()
    const handleEvent = vi.spyOn(useRealtimeStore(), 'handleEvent').mockResolvedValue()
    const socket = lastSocket()
    socket.open()

    socket.receive('no es JSON')
    socket.receive(JSON.stringify({ type: 'desconocido', payload: {} }))
    socket.receive(new ArrayBuffer(4))
    expect(handleEvent).not.toHaveBeenCalled()

    const event = { type: 'stock.changed', payload: { warehouseId: 'wa', productIds: ['p1'] } }
    socket.receive(JSON.stringify(event))
    expect(handleEvent).toHaveBeenCalledWith(event, screen)
    // La conexión sigue abierta después de los mensajes mal formados
    expect(useRealtimeStore().status).toBe('connected')
  })
})
