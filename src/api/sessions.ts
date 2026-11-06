import type { ActiveSession, PasswordChangeInput } from '@/types/session'
import { http } from './http'

/** Sesiones activas del usuario, con la de este navegador marcada como `current`. */
export async function listSessions(): Promise<ActiveSession[]> {
  const res = await http.get<ActiveSession[]>('/auth/sessions')
  return res.data
}

/** Cierra una sesión propia (revoca su refresh token). */
export async function revokeSession(id: string): Promise<void> {
  await http.delete(`/auth/sessions/${id}`)
}

/** Cierra todas las sesiones del usuario, incluida esta (borra la cookie). */
export async function logoutAll(): Promise<void> {
  await http.post('/auth/logout-all')
}

/** Cambia la propia contraseña; el servidor cierra las demás sesiones. */
export async function changePassword(input: PasswordChangeInput): Promise<void> {
  await http.put('/auth/password', input)
}
