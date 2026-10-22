import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import ForbiddenView from './ForbiddenView.vue'

async function mountAt(url: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/sin-permiso', component: ForbiddenView },
      { path: '/', component: ForbiddenView },
    ],
  })
  router.push(url)
  await router.isReady()
  return mount(ForbiddenView, { global: { plugins: [router] } })
}

describe('ForbiddenView', () => {
  it('explica que falta el permiso y muestra la ruta pedida', async () => {
    const wrapper = await mountAt('/sin-permiso?from=/stock/entrada')
    expect(wrapper.find('[data-test=forbidden]').text()).toContain('No tienes permiso')
    expect(wrapper.text()).toContain('/stock/entrada')
  })

  it('ofrece volver al inicio y no queda en blanco sin la ruta de origen', async () => {
    const wrapper = await mountAt('/sin-permiso')
    expect(wrapper.text()).toContain('No tienes permiso')
    expect(wrapper.find('a').attributes('href')).toBe('/')
  })
})
