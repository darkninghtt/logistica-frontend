import { afterEach, describe, expect, it } from 'vitest'
import { http } from './http'
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
