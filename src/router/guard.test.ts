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
    await useAuthStore().logout()
    await router.push('/')
    expect(router.currentRoute.value.path).toBe('/login')
  })
})

describe('guard: restaurar la sesión al cargar la página', () => {
  const restored = {
    accessToken: 'token-restaurado',
    user: { id: '1', name: 'Admin', email: 'a@b.co', role: 'ADMIN' as const },
  }

  it('sin token en memoria pero con cookie válida, entra a la ruta sin pasar por el login', async () => {
    vi.mocked(api.refreshSession).mockResolvedValue(restored)
    const router = buildRouter()

    await router.push('/bodegas')

    expect(router.currentRoute.value.path).toBe('/bodegas')
    expect(useAuthStore().user?.name).toBe('Admin')
  })

  it('si la sesión no se puede restaurar, redirige al login con la ruta de retorno', async () => {
    vi.mocked(api.refreshSession).mockRejectedValue(new Error('sin sesión'))
    const router = buildRouter()

    await router.push('/bodegas')

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/bodegas')
  })

  it('intenta restaurar una sola vez por carga de la página', async () => {
    vi.mocked(api.refreshSession).mockRejectedValue(new Error('sin sesión'))
    const router = buildRouter()

    await router.push('/bodegas')
    await router.push('/')

    expect(api.refreshSession).toHaveBeenCalledTimes(1)
  })

  it('con sesión restaurada, abrir el login redirige al inicio', async () => {
    vi.mocked(api.refreshSession).mockResolvedValue(restored)
    const router = buildRouter()

    await router.push('/login')

    expect(router.currentRoute.value.path).toBe('/')
  })

  it('con sesión iniciada no vuelve a llamar al refresh', async () => {
    await signIn()
    const router = buildRouter()

    await router.push('/bodegas')

    expect(api.refreshSession).not.toHaveBeenCalled()
  })
})
