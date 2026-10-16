import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import * as api from '@/api/auth'
import { ApiError } from '@/api/http'
import { setAccessToken } from '@/api/token'
import LoginView from './LoginView.vue'

vi.mock('@/api/auth')

const Stub = { template: '<div />' }

async function mountView(redirect?: string): Promise<{
  wrapper: ReturnType<typeof mount>
  router: Router
}> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', component: LoginView },
      { path: '/', component: Stub },
      { path: '/bodegas', component: Stub },
    ],
  })
  await router.push(redirect ? { path: '/login', query: { redirect } } : '/login')
  await router.isReady()
  const wrapper = mount(LoginView, { global: { plugins: [createPinia(), router] } })
  return { wrapper, router }
}

async function fill(wrapper: ReturnType<typeof mount>, email: string, password: string) {
  await wrapper.find('input[type="email"]').setValue(email)
  await wrapper.find('input[type="password"]').setValue(password)
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  setAccessToken(null)
})

describe('LoginView', () => {
  it('valida los campos antes de llamar a la API', async () => {
    const { wrapper } = await mountView()
    await fill(wrapper, '', '')
    expect(api.login).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('El correo es obligatorio')
    expect(wrapper.text()).toContain('La contraseña es obligatoria')
  })

  it('con login correcto vuelve a la ruta de retorno', async () => {
    vi.mocked(api.login).mockResolvedValue({
      accessToken: 't',
      user: { id: '1', name: 'Admin', email: 'a@b.co', role: 'ADMIN' },
    })
    const { wrapper, router } = await mountView('/bodegas')
    await fill(wrapper, 'a@b.co', 'secreta')
    expect(router.currentRoute.value.path).toBe('/bodegas')
  })

  it('ignora un retorno externo y va al inicio', async () => {
    vi.mocked(api.login).mockResolvedValue({
      accessToken: 't',
      user: { id: '1', name: 'Admin', email: 'a@b.co', role: 'ADMIN' },
    })
    const { wrapper, router } = await mountView('//malicioso.com')
    await fill(wrapper, 'a@b.co', 'secreta')
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('muestra el error del servidor y se queda en el login', async () => {
    vi.mocked(api.login).mockRejectedValue(
      new ApiError('Correo o contraseña incorrectos', 401, 'UNAUTHORIZED', 'c1'),
    )
    const { wrapper, router } = await mountView()
    await fill(wrapper, 'a@b.co', 'mala')
    expect(wrapper.find('[role="alert"]').text()).toBe('Correo o contraseña incorrectos')
    expect(router.currentRoute.value.path).toBe('/login')
  })
})
