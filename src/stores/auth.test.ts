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

    auth.logout()

    expect(auth.isAuthenticated).toBe(false)
    expect(auth.status).toBe('idle')
    expect(getAccessToken()).toBeNull()
  })
})
