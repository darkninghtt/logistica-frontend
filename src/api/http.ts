import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import type { LoginResponse } from '@/types/auth'
import { getAccessToken, setAccessToken } from './token'

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Marca una petición ya reintentada tras un refresh, para no reintentarla en bucle. */
    retriedAfterRefresh?: boolean
    /** Cuántas veces se ha reintentado ya esta petición por un fallo de red o 502/503/504. */
    networkRetries?: number
  }
}

/** Error de la API ya normalizado: los stores y las vistas no conocen axios. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly code: string | null,
    readonly correlationId: string | null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function field(body: unknown, key: string): string | null {
  if (typeof body !== 'object' || body === null || !(key in body)) return null
  const value: unknown = Reflect.get(body, key)
  return typeof value === 'string' ? value : null
}

// Si la respuesta no trae el cuerpo de error de la API (por ejemplo, la corta un proxy),
// estos mensajes aseguran que 403 y 429 se expliquen con claridad.
const STATUS_MESSAGES: Record<number, string> = {
  403: 'No tienes permiso para realizar esta acción',
  429: 'Demasiadas peticiones, intenta de nuevo en unos minutos',
}

/** Convierte cualquier fallo de una petición en un ApiError con mensaje legible para el usuario. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err
  if (axios.isAxiosError(err)) {
    if (err.response) {
      const body: unknown = err.response.data
      return new ApiError(
        field(body, 'message') ??
          STATUS_MESSAGES[err.response.status] ??
          'El servidor devolvió un error',
        err.response.status,
        field(body, 'code'),
        field(body, 'correlationId'),
      )
    }
    return new ApiError('No se pudo conectar con el servidor', null, null, null)
  }
  return new ApiError('Ocurrió un error inesperado', null, null, null)
}

// Endpoints de sesión: un 401 aquí es una respuesta normal, no un token vencido.
const SESSION_ENDPOINTS = ['/auth/login', '/auth/refresh', '/auth/logout']

/**
 * Reintentos automáticos de red. Solo se reintentan los GET (son idempotentes) y solo ante un fallo
 * de red o un 502/503/504, que es lo que se ve mientras Render despierta el servicio. Un POST o PUT
 * nunca se reintenta (podría duplicar la operación) ni tampoco un 4xx o 500: repetirlos no los arregla.
 */
export const retryPolicy = { maxRetries: 2, baseDelayMs: 1000 }
const RETRYABLE_STATUSES = [502, 503, 504]

function shouldRetry(err: unknown): err is AxiosError {
  if (!axios.isAxiosError(err) || !err.config) return false
  if (err.config.method?.toLowerCase() !== 'get') return false
  if ((err.config.networkRetries ?? 0) >= retryPolicy.maxRetries) return false
  if (err.response) return RETRYABLE_STATUSES.includes(err.response.status)
  return err.code !== AxiosError.ERR_CANCELED
}

let onSessionExpired: (() => void) | null = null

/** Registra qué hacer cuando la sesión no se puede renovar (limpiar el store e ir al login). */
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler
}

function attachAuth(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const token = getAccessToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
}

// Único cliente axios de la aplicación. Los componentes no lo usan directamente:
// pasan por los módulos de src/api y los stores. `withCredentials` hace que el navegador envíe
// la cookie del refresh; como la API es del mismo origen (/api), no sale hacia otros sitios.
export const http: AxiosInstance = axios.create({ baseURL: '/api', withCredentials: true })

let refreshInFlight: Promise<LoginResponse> | null = null

/**
 * Renueva la sesión con la cookie del refresh y guarda el access token nuevo en memoria.
 * Un solo refresh compartido: si varias peticiones lo piden a la vez (401 concurrentes), todas
 * esperan la misma llamada. El refresh rota la cookie, así que dos llamadas en paralelo con la
 * cookie vieja harían que el servidor revoque la sesión.
 */
export function refreshSession(): Promise<LoginResponse> {
  refreshInFlight ??= http
    .post<LoginResponse>('/auth/refresh')
    .then((res) => {
      setAccessToken(res.data.accessToken)
      return res.data
    })
    .finally(() => {
      refreshInFlight = null
    })
  return refreshInFlight
}

http.interceptors.request.use(attachAuth)
http.interceptors.response.use(
  (response) => response,
  async (err: unknown) => {
    if (shouldRetry(err) && err.config) {
      const attempt = err.config.networkRetries ?? 0
      // Espera creciente: 1 s y 2 s con la configuración por defecto
      await new Promise((resolve) => setTimeout(resolve, retryPolicy.baseDelayMs * 2 ** attempt))
      return http({ ...err.config, networkRetries: attempt + 1 })
    }
    const apiError = toApiError(err)
    const config = axios.isAxiosError(err) ? err.config : undefined
    const canRefresh =
      apiError.status === 401 &&
      config !== undefined &&
      !config.retriedAfterRefresh &&
      !SESSION_ENDPOINTS.some((endpoint) => config.url?.startsWith(endpoint))
    if (!config || !canRefresh) throw apiError

    try {
      await refreshSession()
    } catch (refreshError) {
      // Sin conexión no se sabe si la sesión sigue viva: se conserva y se informa el error original.
      // Si el servidor rechazó el refresh, la sesión terminó: se cierra y se va al login.
      if (toApiError(refreshError).status !== null) {
        setAccessToken(null)
        onSessionExpired?.()
      }
      throw apiError
    }
    // El reintento toma el token nuevo gracias al interceptor de petición
    return http({ ...config, retriedAfterRefresh: true })
  },
)
