import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import * as api from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import MainLayout from './MainLayout.vue'
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
    const wrapper = mount(MainLayout, { global: { plugins: [createPinia(), router] } })
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
