import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import * as api from '@/api/sessions'
import { toApiError } from '@/api/http'
import { useAuthStore } from './auth'
import type { LoadStatus } from '@/types/api'
import type { ActiveSession, PasswordChangeInput } from '@/types/session'

/**
 * Store de "Mis sesiones": las sesiones activas del usuario (normalizadas), cerrar una, cerrar todas
 * y cambiar la contraseña. Sin caché: es una lista corta y debe verse siempre al día.
 */
export const useSessionsStore = defineStore('sessions', () => {
  const byId = ref<Record<string, ActiveSession>>({})
  const ids = ref<string[]>([])
  const status = ref<LoadStatus>('idle')
  const error = ref<string | null>(null)
  let listRequest = 0

  /** Cerrar una o todas: bloquea los botones mientras corre. */
  const acting = ref(false)
  const actionError = ref<string | null>(null)

  const passwordStatus = ref<LoadStatus>('idle')
  const passwordError = ref<string | null>(null)

  const items = computed<ActiveSession[]>(() =>
    ids.value.flatMap((id) => {
      const session = byId.value[id]
      return session ? [session] : []
    }),
  )

  async function fetchSessions(): Promise<void> {
    const request = ++listRequest
    status.value = 'loading'
    error.value = null
    try {
      const sessions = await api.listSessions()
      if (request !== listRequest) return
      byId.value = Object.fromEntries(sessions.map((s) => [s.id, s]))
      ids.value = sessions.map((s) => s.id)
      status.value = 'success'
    } catch (err) {
      if (request !== listRequest) return
      error.value = toApiError(err).message
      status.value = 'error'
    }
  }

  /** Cierra otra sesión: ese navegador pierde la sesión la próxima vez que intente renovarla. */
  async function revoke(id: string): Promise<boolean> {
    if (acting.value) return false
    acting.value = true
    actionError.value = null
    try {
      await api.revokeSession(id)
      ids.value = ids.value.filter((sessionId) => sessionId !== id)
      byId.value = Object.fromEntries(Object.entries(byId.value).filter(([key]) => key !== id))
      return true
    } catch (err) {
      actionError.value = toApiError(err).message
      // Si ya no existía (404), la lista estaba vieja: se recarga
      if (toApiError(err).status === 404) await fetchSessions()
      return false
    } finally {
      acting.value = false
    }
  }

  /** Cierra todas las sesiones, incluida esta: después hay que volver a iniciar sesión. */
  async function logoutAll(): Promise<boolean> {
    if (acting.value) return false
    acting.value = true
    actionError.value = null
    try {
      await api.logoutAll()
    } catch (err) {
      actionError.value = toApiError(err).message
      return false
    } finally {
      acting.value = false
    }
    useAuthStore().clearSession()
    return true
  }

  /** Cambia la propia contraseña. El servidor cierra las demás sesiones; esta sigue abierta. */
  async function changePassword(input: PasswordChangeInput): Promise<boolean> {
    if (passwordStatus.value === 'loading') return false
    passwordStatus.value = 'loading'
    passwordError.value = null
    try {
      await api.changePassword(input)
    } catch (err) {
      passwordError.value = toApiError(err).message
      passwordStatus.value = 'error'
      return false
    }
    passwordStatus.value = 'success'
    await fetchSessions()
    return true
  }

  /** Descarta las respuestas en vuelo al cerrar la sesión (ver el plugin `resetOnSessionEnd`). */
  function cancelPending(): void {
    listRequest++
  }

  return {
    byId,
    ids,
    status,
    error,
    acting,
    actionError,
    passwordStatus,
    passwordError,
    items,
    fetchSessions,
    revoke,
    logoutAll,
    changePassword,
    cancelPending,
  }
})
