export type Role = 'ADMIN' | 'WAREHOUSE_MANAGER' | 'OPERATOR' | 'AUDITOR'

/** Usuario autenticado tal como lo devuelve POST /api/auth/login. */
export interface AuthUser {
  id: string
  name: string
  email: string
  role: Role
}

/** Cuerpo de POST /api/auth/login. */
export interface LoginInput {
  email: string
  password: string
}

/** Respuesta de POST /api/auth/login. */
export interface LoginResponse {
  accessToken: string
  user: AuthUser
}
