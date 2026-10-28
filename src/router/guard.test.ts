import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import * as api from '@/api/auth'
import { setAccessToken } from '@/api/token'
import { useAuthStore } from '@/stores/auth'
import { installAuthGuard } from './guard'
import type { Role } from '@/types/auth'

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

describe('guard: permisos por rol', () => {
  function buildRouterWithPermissions(): Router {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', component: Stub, meta: { public: true } },
        { path: '/', component: Stub },
        { path: '/stock/entrada', component: Stub, meta: { permission: 'stock:entry' } },
        { path: '/sin-permiso', component: Stub },
      ],
    })
    installAuthGuard(router)
    return router
  }

  async function signInAs(role: Role): Promise<void> {
    vi.mocked(api.login).mockResolvedValue({
      accessToken: 't',
      user: { id: '1', name: 'Usuario', email: 'u@b.co', role },
    })
    await useAuthStore().login({ email: 'u@b.co', password: 'x' })
  }

  it.each(['ADMIN', 'WAREHOUSE_MANAGER'] as const)(
    '%s entra a la entrada de stock',
    async (role) => {
      await signInAs(role)
      const router = buildRouterWithPermissions()
      await router.push('/stock/entrada')
      expect(router.currentRoute.value.path).toBe('/stock/entrada')
    },
  )

  it.each(['OPERATOR', 'AUDITOR'] as const)(
    '%s que abre la entrada de stock por URL va a la pantalla de sin permiso',
    async (role) => {
      await signInAs(role)
      const router = buildRouterWithPermissions()
      await router.push('/stock/entrada')
      expect(router.currentRoute.value.path).toBe('/sin-permiso')
      expect(router.currentRoute.value.query.from).toBe('/stock/entrada')
    },
  )

  it('las rutas sin permiso requerido quedan abiertas a cualquier rol con sesión', async () => {
    await signInAs('OPERATOR')
    const router = buildRouterWithPermissions()
    await router.push('/')
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('sin sesión sigue yendo al login (no a sin-permiso)', async () => {
    const router = buildRouterWithPermissions()
    await router.push('/stock/entrada')
    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('el router real exige el permiso en la entrada de stock y en las mermas', async () => {
    const { routes } = await import('@/router')
    const children = routes.flatMap((r) => r.children ?? [])
    expect(children.find((r) => r.path === 'stock/entrada')?.meta?.permission).toBe('stock:entry')
    expect(children.find((r) => r.path === 'stock/merma')?.meta?.permission).toBe('stock:shrinkage')
  })
})
