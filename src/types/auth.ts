import type { ApiSchema } from './contract'

export type Role = ApiSchema<'User'>['role']

/** Usuario autenticado tal como lo devuelve POST /api/auth/login. */
export type AuthUser = ApiSchema<'User'>

/** Cuerpo de POST /api/auth/login. */
export type LoginInput = ApiSchema<'LoginRequest'>

/** Respuesta de POST /api/auth/login. */
export type LoginResponse = ApiSchema<'LoginResponse'>
