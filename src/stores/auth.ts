import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import * as api from '@/api/auth'
import { toApiError } from '@/api/http'
import { setAccessToken } from '@/api/token'
import { roleCan, type Permission } from '@/permissions'
import type { AuthUser, LoginInput, Role } from '@/types/auth'

export type AuthStatus = 'idle' | 'loading' | 'success' | 'error'

/**
 * Store de sesión. El access token NO se guarda aquí: vive en memoria en `api/token.ts`
 * (nunca en localStorage/sessionStorage ni en estado persistido). Al recargar la página la
 * sesión se restaura con la cookie del refresh (`restoreSession`).
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const status = ref<AuthStatus>('idle')
  const error = ref<string | null>(null)
  /** Ya se intentó restaurar la sesión en esta carga de la página (el guard lo hace una sola vez). */
  const sessionChecked = ref(false)

  const isAuthenticated = computed(() => user.value !== null)
  const role = computed<Role | null>(() => user.value?.role ?? null)

  /** ¿El rol del usuario permite esta acción? (solo cortesía de la interfaz; manda el backend). */
  function can(permission: Permission): boolean {
    return roleCan(role.value, permission)
  }

  /** Inicia sesión. Devuelve false y deja `error` si las credenciales o la red fallan. */
  async function login(input: LoginInput): Promise<boolean> {
    status.value = 'loading'
    error.value = null
    try {
      const result = await api.login(input)
      setAccessToken(result.accessToken)
      user.value = result.user
      status.value = 'success'
      return true
    } catch (err) {
      error.value = toApiError(err).message
      status.value = 'error'
      return false
    }
  }

  /** Intenta recuperar la sesión con la cookie del refresh. Devuelve true si hay sesión. */
  async function restoreSession(): Promise<boolean> {
    if (user.value) return true
    try {
      const result = await api.refreshSession()
      user.value = result.user
      status.value = 'success'
      return true
    } catch {
      // Sin cookie o con una sesión vencida: simplemente no hay sesión
      return false
    } finally {
      sessionChecked.value = true
    }
  }

  /** Borra la sesión solo en el cliente (también la usa el interceptor cuando el refresh falla). */
  function clearSession(): void {
    setAccessToken(null)
    user.value = null
    status.value = 'idle'
    error.value = null
    sessionChecked.value = true
  }

  /** Cierra la sesión: avisa al servidor (si falla igual se cierra en el cliente) y la borra. */
  async function logout(): Promise<void> {
    try {
      await api.logout()
    } catch {
      // Sin conexión o sesión ya vencida: igual se cierra localmente
    }
    clearSession()
  }

  return {
    user,
    status,
    error,
    sessionChecked,
    isAuthenticated,
    role,
    can,
    login,
    restoreSession,
    clearSession,
    logout,
  }
})
