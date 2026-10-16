import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { getAccessToken } from './token'

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

/** Convierte cualquier fallo de una petición en un ApiError con mensaje legible para el usuario. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err
  if (axios.isAxiosError(err)) {
    if (err.response) {
      const body: unknown = err.response.data
      return new ApiError(
        field(body, 'message') ?? 'El servidor devolvió un error',
        err.response.status,
        field(body, 'code'),
        field(body, 'correlationId'),
      )
    }
    return new ApiError('No se pudo conectar con el servidor', null, null, null)
  }
  return new ApiError('Ocurrió un error inesperado', null, null, null)
}

function attachAuth(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const token = getAccessToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
}

// Único cliente axios de la aplicación. Los componentes no lo usan directamente:
// pasan por los módulos de src/api y los stores.
export const http: AxiosInstance = axios.create({ baseURL: '/api' })

http.interceptors.request.use(attachAuth)
http.interceptors.response.use(
  (response) => response,
  (err: unknown) => Promise.reject(toApiError(err)),
)
