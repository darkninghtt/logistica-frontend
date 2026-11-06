/** Una sesión activa del usuario (GET /api/auth/sessions): una familia de refresh tokens. */
export interface ActiveSession {
  id: string
  /** Navegador desde el que se abrió (encabezado User-Agent), si se conoce. */
  userAgent: string | null
  createdAt: string
  /** Último inicio de sesión o renovación. */
  lastUsedAt: string | null
  /** Es la sesión de este navegador. */
  current: boolean
}

/** Cuerpo de PUT /api/auth/password. */
export interface PasswordChangeInput {
  currentPassword: string
  newPassword: string
}
