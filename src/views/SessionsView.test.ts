import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import * as api from '@/api/sessions'
import { ApiError } from '@/api/http'
import { piniaSignedInAs } from '@/testing'
import SessionsView from './SessionsView.vue'
import type { ActiveSession } from '@/types/session'

vi.mock('@/api/sessions')

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

function session(id: string, current = false): ActiveSession {
  return {
    id,
    userAgent: CHROME,
    createdAt: '2026-11-01T10:00:00.000Z',
    lastUsedAt: null,
    current,
  }
}

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/mi-cuenta', component: SessionsView },
      { path: '/login', component: { template: '<p>login</p>' } },
    ],
  })
  await router.push('/mi-cuenta')
  const wrapper = mount(SessionsView, {
    global: { plugins: [piniaSignedInAs('WAREHOUSE_MANAGER'), router] },
  })
  await flushPromises()
  return { wrapper, router }
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('SessionsView', () => {
  it('muestra la carga mientras espera', () => {
    vi.mocked(api.listSessions).mockReturnValue(new Promise(() => undefined))
    const wrapper = mount(SessionsView, {
      global: { plugins: [piniaSignedInAs('OPERATOR')], stubs: ['RouterLink'] },
    })
    expect(wrapper.text()).toContain('Cargando sesiones')
  })

  it('lista las sesiones y marca la actual, que no se puede cerrar desde aquí', async () => {
    vi.mocked(api.listSessions).mockResolvedValue([session('s1', true), session('s2')])
    const { wrapper } = await mountView()

    const rows = wrapper.findAll('[data-test=session-row]')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.text()).toContain('Chrome en Windows')
    expect(rows[0]?.text()).toContain('Esta sesión')
    expect(rows[0]?.find('button').exists()).toBe(false)
    expect(rows[1]?.find('button').text()).toBe('Cerrar')
  })

  it('cierra otra sesión', async () => {
    vi.mocked(api.listSessions).mockResolvedValue([session('s1', true), session('s2')])
    vi.mocked(api.revokeSession).mockResolvedValue()
    const { wrapper } = await mountView()

    await wrapper.findAll('[data-test=session-row]')[1]?.find('button').trigger('click')
    await flushPromises()

    expect(api.revokeSession).toHaveBeenCalledWith('s2')
    expect(wrapper.findAll('[data-test=session-row]')).toHaveLength(1)
  })

  it('cerrar todas lleva al login', async () => {
    vi.mocked(api.listSessions).mockResolvedValue([session('s1', true)])
    vi.mocked(api.logoutAll).mockResolvedValue()
    const { wrapper, router } = await mountView()

    await wrapper.find('button.all').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('muestra el error y permite reintentar', async () => {
    vi.mocked(api.listSessions)
      .mockRejectedValueOnce(new ApiError('Caído', 503, null, null))
      .mockResolvedValueOnce([session('s1', true)])
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('No se pudieron cargar las sesiones: Caído')

    await wrapper.find('[role=alert] button').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('[data-test=session-row]')).toHaveLength(1)
  })

  it('muestra el vacío', async () => {
    vi.mocked(api.listSessions).mockResolvedValue([])
    const { wrapper } = await mountView()
    expect(wrapper.find('[data-test=empty]').exists()).toBe(true)
  })

  it('cambia la contraseña, confirma y limpia el formulario', async () => {
    vi.mocked(api.listSessions).mockResolvedValue([session('s1', true)])
    vi.mocked(api.changePassword).mockResolvedValue()
    const { wrapper } = await mountView()

    await wrapper.find('input[name=currentPassword]').setValue('Actual-2026-ok')
    await wrapper.find('input[name=newPassword]').setValue('Nueva-clave-2026')
    await wrapper.find('input[name=confirmation]').setValue('Nueva-clave-2026')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(api.changePassword).toHaveBeenCalledWith({
      currentPassword: 'Actual-2026-ok',
      newPassword: 'Nueva-clave-2026',
    })
    expect(wrapper.find('[data-test=password-done]').exists()).toBe(true)
    expect(wrapper.find<HTMLInputElement>('input[name=newPassword]').element.value).toBe('')
  })

  it('muestra el error de contraseña actual incorrecta', async () => {
    vi.mocked(api.listSessions).mockResolvedValue([session('s1', true)])
    vi.mocked(api.changePassword).mockRejectedValue(
      new ApiError('La contraseña actual no es correcta', 400, 'VALIDATION_ERROR', null),
    )
    const { wrapper } = await mountView()

    await wrapper.find('input[name=currentPassword]').setValue('mala')
    await wrapper.find('input[name=newPassword]').setValue('Nueva-clave-2026')
    await wrapper.find('input[name=confirmation]').setValue('Nueva-clave-2026')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('form').text()).toContain('La contraseña actual no es correcta')
  })
})

describe('PasswordChangeForm (validación)', () => {
  it('no envía si falta la actual, la nueva es corta o no coincide la confirmación', async () => {
    vi.mocked(api.listSessions).mockResolvedValue([])
    const { wrapper } = await mountView()

    await wrapper.find('input[name=newPassword]').setValue('corta')
    await wrapper.find('input[name=confirmation]').setValue('otra')
    await wrapper.find('form').trigger('submit')

    expect(api.changePassword).not.toHaveBeenCalled()
    expect(wrapper.find('form').text()).toContain('Escribe tu contraseña actual')
    expect(wrapper.find('form').text()).toContain('al menos 12 caracteres')
    expect(wrapper.find('form').text()).toContain('Las contraseñas no coinciden')
  })

  it('la nueva debe ser distinta de la actual', async () => {
    vi.mocked(api.listSessions).mockResolvedValue([])
    const { wrapper } = await mountView()

    await wrapper.find('input[name=currentPassword]').setValue('Misma-clave-2026')
    await wrapper.find('input[name=newPassword]').setValue('Misma-clave-2026')
    await wrapper.find('input[name=confirmation]').setValue('Misma-clave-2026')
    await wrapper.find('form').trigger('submit')

    expect(api.changePassword).not.toHaveBeenCalled()
    expect(wrapper.find('form').text()).toContain('debe ser distinta')
  })
})
