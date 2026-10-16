import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import * as api from '@/api/auth'
import { setAccessToken } from '@/api/token'
import { useAuthStore } from '@/stores/auth'
import { installAuthGuard } from './guard'

vi.mock('@/api/auth')

const Stub = { template: '<div />' }

function buildRouter(): Router {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', component: Stub, meta: { public: true } },
      { path: '/', component: Stub },
      { path: '/bodegas', component: Stub },
    ],
  })
  installAuthGuard(router)
  return router
}

async function signIn(): Promise<void> {
  vi.mocked(api.login).mockResolvedValue({
    accessToken: 't',
    user: { id: '1', name: 'Admin', email: 'a@b.co', role: 'ADMIN' },
  })
  await useAuthStore().login({ email: 'a@b.co', password: 'x' })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  setAccessToken(null)
})

describe('guard de autenticación', () => {
  it('sin sesión, una ruta protegida redirige al login con la ruta de retorno', async () => {
    const router = buildRouter()
    await router.push('/bodegas')
    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/bodegas')
  })

  it('con sesión, deja entrar a las rutas protegidas', async () => {
    await signIn()
    const router = buildRouter()
    await router.push('/bodegas')
    expect(router.currentRoute.value.path).toBe('/bodegas')
  })

  it('sin sesión, el login es accesible', async () => {
    const router = buildRouter()
    await router.push('/login')
    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('con sesión, entrar al login redirige al inicio', async () => {
    await signIn()
    const router = buildRouter()
    await router.push('/login')
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('tras cerrar sesión vuelve a proteger las rutas', async () => {
    await signIn()
    const router = buildRouter()
    await router.push('/bodegas')
    useAuthStore().logout()
    await router.push('/')
    expect(router.currentRoute.value.path).toBe('/login')
  })
})
