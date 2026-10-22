import type { LoginInput, LoginResponse } from '@/types/auth'
import { http } from './http'

// Restaurar la sesión al recargar es un refresh: se comparte con el interceptor de http.ts
export { refreshSession } from './http'

export async function login(input: LoginInput): Promise<LoginResponse> {
  const res = await http.post<LoginResponse>('/auth/login', input)
  return res.data
}

/** Cierra la sesión en el servidor (revoca el refresh token y borra la cookie). */
export async function logout(): Promise<void> {
  await http.post('/auth/logout')
}
