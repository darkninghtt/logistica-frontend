import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import * as api from '@/api/auth'
import { toApiError } from '@/api/http'
import { setAccessToken } from '@/api/token'
import type { AuthUser, LoginInput } from '@/types/auth'

export type AuthStatus = 'idle' | 'loading' | 'success' | 'error'

/**
 * Store de sesión. El access token NO se guarda aquí: vive en memoria en `api/token.ts`
 * (nunca en localStorage/sessionStorage ni en estado persistido), así que al recargar
 * la página la sesión se pierde. Restaurarla con refresh token es de la semana 2.
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const status = ref<AuthStatus>('idle')
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => user.value !== null)

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

  function logout(): void {
    setAccessToken(null)
    user.value = null
    status.value = 'idle'
    error.value = null
  }

  return { user, status, error, isAuthenticated, login, logout }
})
