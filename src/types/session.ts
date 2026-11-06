import type { ApiSchema } from './contract'

/** Una sesión activa del usuario (GET /api/auth/sessions): una familia de refresh tokens. */
export type ActiveSession = ApiSchema<'Session'>

/** Cuerpo de PUT /api/auth/password. */
export type PasswordChangeInput = ApiSchema<'PasswordChangeInput'>
