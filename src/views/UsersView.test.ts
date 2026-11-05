import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import * as api from '@/api/users'
import * as warehousesApi from '@/api/warehouses'
import { ApiError } from '@/api/http'
import UsersView from './UsersView.vue'
import { piniaSignedInAs } from '@/testing'
import type { ManagedUser } from '@/types/user'

vi.mock('@/api/users')
vi.mock('@/api/warehouses')

function user(id: string, overrides: Partial<ManagedUser> = {}): ManagedUser {
  return {
    id,
    name: `Usuario ${id}`,
    email: `${id}@b.co`,
    role: 'OPERATOR',
    active: true,
    warehouseIds: ['wa'],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function pageOf(users: ManagedUser[]) {
  return { data: users, page: 1, pageSize: 10, total: users.length }
}

async function mountView() {
  // piniaSignedInAs('ADMIN') deja la sesión con el id `u-ADMIN`
  const wrapper = mount(UsersView, { global: { plugins: [piniaSignedInAs('ADMIN')] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  vi.mocked(warehousesApi.listWarehouses).mockResolvedValue({
    data: [{ id: 'wa', code: 'A', name: 'Bodega A', active: true, createdAt: '' }],
    page: 1,
    pageSize: 100,
    total: 1,
  })
})

describe('UsersView', () => {
  it('muestra el estado de carga mientras espera la respuesta', () => {
    vi.mocked(api.listUsers).mockReturnValue(new Promise(() => undefined))
    const wrapper = mount(UsersView, { global: { plugins: [piniaSignedInAs('ADMIN')] } })
    expect(wrapper.text()).toContain('Cargando usuarios')
  })

  it('lista los usuarios con rol, bodegas y estado', async () => {
    vi.mocked(api.listUsers).mockResolvedValue(
      pageOf([
        user('u1'),
        user('u2', { role: 'AUDITOR', warehouseIds: [], active: false }),
        user('u3', { role: 'WAREHOUSE_MANAGER', warehouseIds: [] }),
      ]),
    )
    const wrapper = await mountView()

    const rows = wrapper.findAll('[data-test=user-row]').map((r) => r.text())
    expect(rows[0]).toContain('Operario')
    expect(rows[0]).toContain('A · Bodega A')
    expect(rows[1]).toContain('Auditor')
    expect(rows[1]).toContain('Todas')
    expect(rows[1]).toContain('Inactivo')
    expect(rows[2]).toContain('Ninguna')
  })

  it('muestra el estado vacío', async () => {
    vi.mocked(api.listUsers).mockResolvedValue(pageOf([]))
    const wrapper = await mountView()
    expect(wrapper.find('[data-test=empty]').exists()).toBe(true)
  })

  it('muestra el error y permite reintentar', async () => {
    vi.mocked(api.listUsers)
      .mockRejectedValueOnce(new ApiError('No se pudo conectar con el servidor', null, null, null))
      .mockResolvedValueOnce(pageOf([user('u1')]))
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('No se pudo conectar con el servidor')

    await wrapper.find('[role=alert] button').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('[data-test=user-row]')).toHaveLength(1)
  })

  it('crea un usuario desde el formulario y lo cierra al guardar', async () => {
    vi.mocked(api.listUsers).mockResolvedValue(pageOf([user('u1')]))
    vi.mocked(api.createUser).mockResolvedValue(user('u9', { warehouseIds: [] }))
    vi.mocked(api.setUserWarehouses).mockResolvedValue({ userId: 'u9', warehouseIds: ['wa'] })
    const wrapper = await mountView()

    await wrapper.find('.header button').trigger('click')
    await wrapper.find('input[name=name]').setValue('Jefe Nuevo')
    await wrapper.find('input[name=email]').setValue('jefe@b.co')
    await wrapper.find('select[name=role]').setValue('WAREHOUSE_MANAGER')
    await wrapper.find('input[name=password]').setValue('Clave-segura-2026')
    await wrapper.find('input[value=wa]').setValue(true)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(api.setUserWarehouses).toHaveBeenCalledWith('u9', ['wa'])
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('muestra en el formulario el error de correo repetido', async () => {
    vi.mocked(api.listUsers).mockResolvedValue(pageOf([user('u1')]))
    vi.mocked(api.createUser).mockRejectedValue(
      new ApiError('Ya existe un usuario con ese correo', 409, 'CONFLICT', null),
    )
    const wrapper = await mountView()

    await wrapper.find('.header button').trigger('click')
    await wrapper.find('input[name=name]').setValue('Repetido')
    await wrapper.find('input[name=email]').setValue('u1@b.co')
    await wrapper.find('input[name=password]').setValue('Clave-segura-2026')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('form').text()).toContain('Ya existe un usuario con ese correo')
  })

  it('desactiva a un usuario desde la lista, pero no ofrece desactivarse a sí mismo', async () => {
    vi.mocked(api.listUsers).mockResolvedValue(
      pageOf([user('u1'), user('u-ADMIN', { role: 'ADMIN', warehouseIds: [] })]),
    )
    vi.mocked(api.updateUser).mockResolvedValue(user('u1', { active: false }))
    const wrapper = await mountView()

    const [other, self] = wrapper.findAll('[data-test=user-row]')
    expect(self?.text()).not.toContain('Desactivar')
    await other?.findAll('button')[1]?.trigger('click')
    await flushPromises()

    expect(api.updateUser).toHaveBeenCalledWith('u1', expect.objectContaining({ active: false }))
  })
})
