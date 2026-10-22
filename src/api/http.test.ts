import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { ApiError, http, refreshSession, setSessionExpiredHandler } from './http'
import { getAccessToken, setAccessToken } from './token'

// Devuelve el valor del header Authorization que realmente sale en la petición.
async function sentAuthorization(): Promise<unknown> {
  let sent: unknown
  await http.get('/ping', {
    adapter: async (config) => {
      sent = config.headers.get('Authorization')
      return { data: null, status: 200, statusText: 'OK', headers: {}, config }
    },
  })
  return sent
}

// Respuesta de error del servidor simulada con un adaptador (no sale a la red).
async function failWith(status: number, data: unknown): Promise<unknown> {
  return http
    .get('/ping', {
      adapter: async (config) => {
        throw new AxiosError('fallo', undefined, config, null, {
          data,
          status,
          statusText: '',
          headers: {},
          config,
        })
      },
    })
    .catch((err: unknown) => err)
}

describe('errores de la API', () => {
  it('convierte el cuerpo de error en un ApiError con su mensaje, código y correlationId', async () => {
    const err = await failWith(409, {
      code: 'CONFLICT',
      message: 'Ya existe',
      correlationId: 'c-1',
    })

    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({
      message: 'Ya existe',
      status: 409,
      code: 'CONFLICT',
      correlationId: 'c-1',
    })
  })

  it('usa un mensaje genérico si el cuerpo no tiene el formato esperado', async () => {
    expect(await failWith(500, '<html>')).toMatchObject({
      message: 'El servidor devolvió un error',
      status: 500,
    })
  })

  it('avisa cuando no hay conexión', async () => {
    const err = await http
      .get('/ping', {
        adapter: async (config) => {
          throw new AxiosError('Network Error', 'ERR_NETWORK', config)
        },
      })
      .catch((e: unknown) => e)

    expect(err).toMatchObject({ message: 'No se pudo conectar con el servidor', status: null })
  })
})

describe('cliente http', () => {
  afterEach(() => setAccessToken(null))

  it('agrega el header Authorization cuando hay token', async () => {
    setAccessToken('abc')
    expect(await sentAuthorization()).toBe('Bearer abc')
  })

  it('no agrega el header cuando no hay token', async () => {
    expect(await sentAuthorization()).toBeUndefined()
  })
})

// Respuesta simulada: con status >= 400 se comporta como un fallo de axios.
function reply(config: InternalAxiosRequestConfig, status: number, data: unknown): AxiosResponse {
  const response = { data, status, statusText: '', headers: {}, config }
  if (status >= 400) throw new AxiosError('fallo', undefined, config, null, response)
  return response
}

const EXPIRED = { code: 'UNAUTHORIZED', message: 'Token inválido o expirado', correlationId: 'c-1' }
const NEW_SESSION = {
  accessToken: 'nuevo',
  user: { id: '1', name: 'Admin', email: 'a@b.co', role: 'ADMIN' },
}

// La API simulada solo acepta el token 'nuevo'; con cualquier otro responde 401.
async function api(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  return config.headers.get('Authorization') === 'Bearer nuevo'
    ? reply(config, 200, { ok: true })
    : reply(config, 401, EXPIRED)
}

describe('renovación de sesión ante un 401', () => {
  const originalAdapter = http.defaults.adapter
  const expired = vi.fn()
  let refreshCalls = 0

  function refreshResponds(status: number, delayMs = 0): void {
    http.defaults.adapter = async (config) => {
      refreshCalls++
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      return reply(config, status, status === 200 ? NEW_SESSION : EXPIRED)
    }
  }

  beforeEach(() => {
    refreshCalls = 0
    expired.mockReset()
    setSessionExpiredHandler(expired)
    setAccessToken('viejo')
  })

  afterEach(() => {
    http.defaults.adapter = originalAdapter
    setSessionExpiredHandler(null)
    setAccessToken(null)
  })

  it('renueva el token y reintenta la petición original con el token nuevo', async () => {
    refreshResponds(200)
    const res = await http.get('/datos', { adapter: api })

    expect(res.data).toEqual({ ok: true })
    expect(refreshCalls).toBe(1)
    expect(getAccessToken()).toBe('nuevo')
    expect(expired).not.toHaveBeenCalled()
  })

  it('varias peticiones concurrentes con el token vencido provocan un único refresh', async () => {
    refreshResponds(200, 20)
    const results = await Promise.all([
      http.get('/a', { adapter: api }),
      http.get('/b', { adapter: api }),
      http.get('/c', { adapter: api }),
    ])

    expect(results.map((r) => r.status)).toEqual([200, 200, 200])
    expect(refreshCalls).toBe(1)
  })

  it('si el refresh falla cierra la sesión y rechaza con el error original', async () => {
    refreshResponds(401)
    const err = await http.get('/datos', { adapter: api }).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 401, code: 'UNAUTHORIZED' })
    expect(getAccessToken()).toBeNull()
    expect(expired).toHaveBeenCalledTimes(1)
  })

  it('si no hay conexión durante el refresh conserva la sesión', async () => {
    http.defaults.adapter = async (config) => {
      throw new AxiosError('Network Error', 'ERR_NETWORK', config)
    }
    const err = await http.get('/datos', { adapter: api }).catch((e: unknown) => e)

    expect(err).toMatchObject({ status: 401 })
    expect(getAccessToken()).toBe('viejo')
    expect(expired).not.toHaveBeenCalled()
  })

  it('reintenta una sola vez: si el 401 persiste tras el refresh, rechaza sin bucle', async () => {
    refreshResponds(200)
    const siempre401 = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> =>
      reply(config, 401, EXPIRED)
    const err = await http.get('/datos', { adapter: siempre401 }).catch((e: unknown) => e)

    expect(err).toMatchObject({ status: 401 })
    expect(refreshCalls).toBe(1)
  })

  it('un 401 del login (credenciales malas) no intenta renovar la sesión', async () => {
    refreshResponds(200)
    const err = await http
      .post('/auth/login', {}, { adapter: async (config) => reply(config, 401, EXPIRED) })
      .catch((e: unknown) => e)

    expect(err).toMatchObject({ status: 401 })
    expect(refreshCalls).toBe(0)
    expect(expired).not.toHaveBeenCalled()
  })

  it('un error que no es 401 no intenta renovar la sesión', async () => {
    refreshResponds(200)
    const err = await http
      .get('/datos', { adapter: async (config) => reply(config, 500, {}) })
      .catch((e: unknown) => e)

    expect(err).toMatchObject({ status: 500 })
    expect(refreshCalls).toBe(0)
  })
})

describe('refreshSession', () => {
  const originalAdapter = http.defaults.adapter
  let calls = 0
  let sentCredentials: boolean | undefined

  beforeEach(() => {
    calls = 0
    sentCredentials = undefined
    setAccessToken(null)
    http.defaults.adapter = async (config) => {
      calls++
      sentCredentials = config.withCredentials
      await new Promise((resolve) => setTimeout(resolve, 10))
      return reply(config, 200, NEW_SESSION)
    }
  })

  afterEach(() => {
    http.defaults.adapter = originalAdapter
    setAccessToken(null)
    localStorage.clear()
    sessionStorage.clear()
  })

  it('guarda el access token nuevo solo en memoria y devuelve la sesión', async () => {
    const result = await refreshSession()

    expect(result.user.role).toBe('ADMIN')
    expect(getAccessToken()).toBe('nuevo')
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })

  it('envía las credenciales (la cookie del refresh)', async () => {
    await refreshSession()
    expect(sentCredentials).toBe(true)
  })

  it('llamadas simultáneas comparten una sola petición', async () => {
    await Promise.all([refreshSession(), refreshSession(), refreshSession()])
    expect(calls).toBe(1)
  })

  it('al terminar permite un refresh nuevo', async () => {
    await refreshSession()
    await refreshSession()
    expect(calls).toBe(2)
  })

  it('si falla rechaza con un ApiError y no deja un token guardado', async () => {
    http.defaults.adapter = async (config) => reply(config, 401, EXPIRED)
    const err = await refreshSession().catch((e: unknown) => e)

    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 401 })
    expect(getAccessToken()).toBeNull()
  })
})
