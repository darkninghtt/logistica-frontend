import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import * as api from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import MainLayout from './MainLayout.vue'
import { piniaSignedInAs } from '@/testing'
import type { Role } from '@/types/auth'
import HomeView from '@/views/HomeView.vue'

vi.mock('@/api/auth')

describe('MainLayout', () => {
  it('muestra la navegación principal', async () => {
    // Router de prueba sin el layout como ruta, para no renderizarlo dos veces.
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: HomeView }],
    })
    router.push('/')
    await router.isReady()
    const wrapper = mount(MainLayout, { global: { plugins: [piniaSignedInAs('ADMIN'), router] } })
    const texts = wrapper.findAll('nav a').map((a) => a.text())
    expect(texts).toEqual(['Inicio', 'Bodegas', 'Productos', 'Stock', 'Entrada de stock'])
  })

  it('el botón Cerrar sesión cierra la sesión en el servidor y vuelve al login', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: HomeView },
        { path: '/login', component: HomeView },
      ],
    })
    router.push('/')
    await router.isReady()
    const pinia = createPinia()
    const wrapper = mount(MainLayout, { global: { plugins: [pinia, router] } })
    const auth = useAuthStore(pinia)
    const logout = vi.spyOn(auth, 'logout')

    await wrapper.find('button').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'))

    expect(logout).toHaveBeenCalledTimes(1)
    expect(api.logout).toHaveBeenCalledTimes(1)
  })
})

describe('MainLayout: menú según el rol', () => {
  async function linksFor(role: Role): Promise<string[]> {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: HomeView }],
    })
    router.push('/')
    await router.isReady()
    const wrapper = mount(MainLayout, { global: { plugins: [piniaSignedInAs(role), router] } })
    return wrapper.findAll('nav a').map((a) => a.text())
  }

  it.each([
    ['ADMIN', ['Inicio', 'Bodegas', 'Productos', 'Stock', 'Entrada de stock']],
    [
      'WAREHOUSE_MANAGER',
      ['Inicio', 'Bodegas', 'Productos', 'Stock', 'Entrada de stock', 'Mermas'],
    ],
    ['OPERATOR', ['Inicio', 'Bodegas', 'Productos', 'Stock', 'Mermas']],
    ['AUDITOR', ['Inicio', 'Bodegas', 'Productos', 'Stock']],
  ] as const)('%s ve %j', async (role, expected) => {
    expect(await linksFor(role)).toEqual(expected)
  })

  it('muestra el nombre y el rol del usuario', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: HomeView }],
    })
    router.push('/')
    await router.isReady()
    const wrapper = mount(MainLayout, {
      global: { plugins: [piniaSignedInAs('OPERATOR'), router] },
    })
    expect(wrapper.find('[data-test=user]').text()).toContain('Operario')
  })
})
