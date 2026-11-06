import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia } from 'pinia'
import * as api from '@/api/sessions'
import { ApiError } from '@/api/http'
import { piniaSignedInAs } from '@/testing'
import { useAuthStore } from './auth'
import { useSessionsStore } from './sessions'
import type { ActiveSession } from '@/types/session'

vi.mock('@/api/sessions')

function session(id: string, current = false): ActiveSession {
  return {
    id,
    userAgent: 'Chrome/130.0 (Windows)',
    createdAt: '2026-11-01T10:00:00.000Z',
    lastUsedAt: '2026-11-05T10:00:00.000Z',
    current,
  }
}

beforeEach(() => {
  setActivePinia(piniaSignedInAs('OPERATOR'))
  vi.resetAllMocks()
})

describe('store sessions', () => {
  it('carga las sesiones normalizadas, pasando por loading', async () => {
    vi.mocked(api.listSessions).mockResolvedValue([session('s1', true), session('s2')])
    const store = useSessionsStore()
    const loading = store.fetchSessions()
    expect(store.status).toBe('loading')
    await loading

    expect(store.status).toBe('success')
    expect(store.ids).toEqual(['s1', 's2'])
    expect(store.byId.s1?.current).toBe(true)
  })

  it('si falla la carga queda en error con el mensaje', async () => {
    vi.mocked(api.listSessions).mockRejectedValue(new ApiError('Caído', 503, null, null))
    const store = useSessionsStore()
    await store.fetchSessions()
    expect(store.status).toBe('error')
    expect(store.error).toBe('Caído')
  })

  it('cerrar una sesión la quita de la lista', async () => {
    vi.mocked(api.listSessions).mockResolvedValue([session('s1', true), session('s2')])
    vi.mocked(api.revokeSession).mockResolvedValue()
    const store = useSessionsStore()
    await store.fetchSessions()

    expect(await store.revoke('s2')).toBe(true)
    expect(api.revokeSession).toHaveBeenCalledWith('s2')
    expect(store.ids).toEqual(['s1'])
    expect(store.byId.s2).toBeUndefined()
  })

  it('si la sesión ya no existe (404) muestra el error y recarga la lista', async () => {
    vi.mocked(api.listSessions).mockResolvedValue([session('s1', true)])
    vi.mocked(api.revokeSession).mockRejectedValue(
      new ApiError('La sesión no existe', 404, 'NOT_FOUND', null),
    )
    const store = useSessionsStore()

    expect(await store.revoke('s9')).toBe(false)
    expect(store.actionError).toBe('La sesión no existe')
    expect(api.listSessions).toHaveBeenCalledTimes(1)
    expect(store.acting).toBe(false)
  })

  it('cerrar todas cierra también la sesión local', async () => {
    vi.mocked(api.logoutAll).mockResolvedValue()
    const store = useSessionsStore()

    expect(await store.logoutAll()).toBe(true)
    expect(useAuthStore().isAuthenticated).toBe(false)
  })

  it('si cerrar todas falla, la sesión local sigue abierta', async () => {
    vi.mocked(api.logoutAll).mockRejectedValue(new ApiError('Caído', 503, null, null))
    const store = useSessionsStore()

    expect(await store.logoutAll()).toBe(false)
    expect(store.actionError).toBe('Caído')
    expect(useAuthStore().isAuthenticated).toBe(true)
  })

  it('cambiar la contraseña recarga la lista (las demás sesiones se cerraron)', async () => {
    vi.mocked(api.changePassword).mockResolvedValue()
    vi.mocked(api.listSessions).mockResolvedValue([session('s1', true)])
    const store = useSessionsStore()
    const input = { currentPassword: 'Actual-2026-ok', newPassword: 'Nueva-clave-2026' }

    expect(await store.changePassword(input)).toBe(true)
    expect(api.changePassword).toHaveBeenCalledWith(input)
    expect(store.passwordStatus).toBe('success')
    expect(store.ids).toEqual(['s1'])
  })

  it('con la contraseña actual incorrecta deja el mensaje de la API', async () => {
    vi.mocked(api.changePassword).mockRejectedValue(
      new ApiError('La contraseña actual no es correcta', 400, 'VALIDATION_ERROR', null),
    )
    const store = useSessionsStore()

    const ok = await store.changePassword({ currentPassword: 'x', newPassword: 'Nueva-clave-2026' })
    expect(ok).toBe(false)
    expect(store.passwordStatus).toBe('error')
    expect(store.passwordError).toBe('La contraseña actual no es correcta')
  })
})
