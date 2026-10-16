import { afterEach, describe, expect, it } from 'vitest'
import { AxiosError } from 'axios'
import { ApiError, http } from './http'
import { setAccessToken } from './token'

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
