import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import * as api from '@/api/auth'
import { ApiError } from '@/api/http'
import { getAccessToken, setAccessToken } from '@/api/token'
import { useAuthStore } from './auth'
import type { LoginResponse } from '@/types/auth'

vi.mock('@/api/auth')

const session: LoginResponse = {
  accessToken: 'token-de-prueba',
  user: { id: '1', name: 'Administrador', email: 'admin@logistica.local', role: 'ADMIN' },
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  setAccessToken(null)
  localStorage.clear()
  sessionStorage.clear()
})

describe('store auth', () => {
  it('empieza sin sesión', () => {
    const auth = useAuthStore()
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.status).toBe('idle')
  })

  it('al iniciar sesión guarda el usuario y deja el token solo en memoria', async () => {
    vi.mocked(api.login).mockResolvedValue(session)
    const auth = useAuthStore()

    const ok = await auth.login({ email: 'admin@logistica.local', password: 'x' })

    expect(ok).toBe(true)
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.user?.role).toBe('ADMIN')
    expect(auth.status).toBe('success')
    expect(getAccessToken()).toBe('token-de-prueba')
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })

  it('con credenciales incorrectas deja el error y no abre sesión', async () => {
    vi.mocked(api.login).mockRejectedValue(
      new ApiError('Correo o contraseña incorrectos', 401, 'UNAUTHORIZED', 'c1'),
    )
    const auth = useAuthStore()

    const ok = await auth.login({ email: 'a@b.co', password: 'mala' })

    expect(ok).toBe(false)
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.status).toBe('error')
    expect(auth.error).toBe('Correo o contraseña incorrectos')
    expect(getAccessToken()).toBeNull()
  })

  it('al cerrar sesión borra el usuario y el token', async () => {
    vi.mocked(api.login).mockResolvedValue(session)
    const auth = useAuthStore()
    await auth.login({ email: 'admin@logistica.local', password: 'x' })

    await auth.logout()

    expect(api.logout).toHaveBeenCalledTimes(1)
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.status).toBe('idle')
    expect(getAccessToken()).toBeNull()
  })

  it('cierra la sesión en el cliente aunque el servidor no responda', async () => {
    vi.mocked(api.login).mockResolvedValue(session)
    vi.mocked(api.logout).mockRejectedValue(
      new ApiError('No se pudo conectar con el servidor', null, null, null),
    )
    const auth = useAuthStore()
    await auth.login({ email: 'admin@logistica.local', password: 'x' })

    await auth.logout()

    expect(auth.isAuthenticated).toBe(false)
    expect(getAccessToken()).toBeNull()
  })
})

describe('store auth: restaurar la sesión', () => {
  it('con la cookie del refresh válida recupera al usuario', async () => {
    vi.mocked(api.refreshSession).mockResolvedValue(session)
    const auth = useAuthStore()

    const ok = await auth.restoreSession()

    expect(ok).toBe(true)
    expect(auth.user?.email).toBe('admin@logistica.local')
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.sessionChecked).toBe(true)
  })

  it('sin sesión válida devuelve false y no deja error visible', async () => {
    vi.mocked(api.refreshSession).mockRejectedValue(
      new ApiError('Falta la sesión', 401, 'UNAUTHORIZED', 'c1'),
    )
    const auth = useAuthStore()

    const ok = await auth.restoreSession()

    expect(ok).toBe(false)
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.error).toBeNull()
    expect(auth.sessionChecked).toBe(true)
  })

  it('si ya hay sesión no vuelve a llamar al refresh', async () => {
    vi.mocked(api.login).mockResolvedValue(session)
    const auth = useAuthStore()
    await auth.login({ email: 'admin@logistica.local', password: 'x' })

    expect(await auth.restoreSession()).toBe(true)
    expect(api.refreshSession).not.toHaveBeenCalled()
  })

  it('no guarda nada en localStorage ni sessionStorage', async () => {
    vi.mocked(api.refreshSession).mockResolvedValue(session)
    await useAuthStore().restoreSession()

    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })

  it('clearSession borra la sesión sin llamar al servidor', async () => {
    vi.mocked(api.login).mockResolvedValue(session)
    const auth = useAuthStore()
    await auth.login({ email: 'admin@logistica.local', password: 'x' })

    auth.clearSession()

    expect(auth.isAuthenticated).toBe(false)
    expect(getAccessToken()).toBeNull()
    expect(api.logout).not.toHaveBeenCalled()
  })
})
