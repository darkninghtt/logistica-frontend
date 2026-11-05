import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import * as api from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { useRealtimeStore } from '@/stores/realtime'
import MainLayout from './MainLayout.vue'
import { piniaSignedInAs } from '@/testing'
import type { Role } from '@/types/auth'
import HomeView from '@/views/HomeView.vue'

vi.mock('@/api/auth')
// El layout abre la conexión en vivo: en estas pruebas el ticket no llega y no se abre nada
vi.mock('@/api/realtime')

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
    expect(texts).toEqual([
      'Inicio',
      'Bodegas',
      'Productos',
      'Stock',
      'Entrada de stock',
      'Traspasos',
      'Kardex',
      'Reportes',
      'Usuarios',
    ])
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
    [
      'ADMIN',
      [
        'Inicio',
        'Bodegas',
        'Productos',
        'Stock',
        'Entrada de stock',
        'Traspasos',
        'Kardex',
        'Reportes',
        'Usuarios',
      ],
    ],
    [
      'WAREHOUSE_MANAGER',
      [
        'Inicio',
        'Bodegas',
        'Productos',
        'Stock',
        'Entrada de stock',
        'Mermas',
        'Traspasos',
        'Kardex',
        'Reportes',
      ],
    ],
    ['OPERATOR', ['Inicio', 'Bodegas', 'Productos', 'Stock', 'Mermas', 'Traspasos']],
    ['AUDITOR', ['Inicio', 'Bodegas', 'Productos', 'Stock', 'Traspasos', 'Kardex', 'Reportes']],
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

describe('MainLayout: tiempo real', () => {
  async function mountSignedIn() {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: HomeView }],
    })
    router.push('/')
    await router.isReady()
    const pinia = piniaSignedInAs('OPERATOR')
    const wrapper = mount(MainLayout, { global: { plugins: [pinia, router] } })
    return { wrapper, realtime: useRealtimeStore(pinia) }
  }

  it('muestra el estado de la conexión en vivo', async () => {
    const { wrapper, realtime } = await mountSignedIn()

    realtime.setStatus('connected')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test=realtime-status]').text()).toBe('En vivo')

    realtime.setStatus('disconnected')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test=realtime-status]').text()).toBe('Sin conexión en vivo')
  })

  it('muestra los avisos con su enlace y se pueden cerrar', async () => {
    const { wrapper, realtime } = await mountSignedIn()

    realtime.notify('Va en camino un traspaso hacia Bodega B.', '/traspasos/t1')
    await wrapper.vm.$nextTick()
    const notice = wrapper.find('[data-test=notice]')
    expect(notice.text()).toContain('Va en camino un traspaso hacia Bodega B.')
    expect(notice.find('a').attributes('href')).toBe('/traspasos/t1')

    await notice.find('button').trigger('click')
    expect(wrapper.findAll('[data-test=notice]')).toHaveLength(0)
  })
})
