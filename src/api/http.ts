import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { getAccessToken } from './token'

function attachAuth(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const token = getAccessToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
}

// Único cliente axios de la aplicación. Los componentes no lo usan directamente:
// pasan por los módulos de src/api y los stores.
export const http: AxiosInstance = axios.create({ baseURL: '/api' })

http.interceptors.request.use(attachAuth)
