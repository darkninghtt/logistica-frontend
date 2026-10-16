import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import MainLayout from './MainLayout.vue'
import HomeView from '@/views/HomeView.vue'

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
})
