import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UserForm from './UserForm.vue'
import type { ManagedUser } from '@/types/user'
import type { Warehouse } from '@/types/warehouse'

const WAREHOUSES: Warehouse[] = [
  { id: 'wa', code: 'A', name: 'Bodega A', active: true, createdAt: '' },
  { id: 'wb', code: 'B', name: 'Bodega B', active: true, createdAt: '' },
  { id: 'wz', code: 'Z', name: 'Bodega Z', active: false, createdAt: '' },
]

const EXISTING: ManagedUser = {
  id: 'u1',
  name: 'Operario Uno',
  email: 'op@b.co',
  role: 'OPERATOR',
  active: true,
  warehouseIds: ['wb'],
  createdAt: '2026-01-01T00:00:00.000Z',
}

function mountForm(props: Partial<InstanceType<typeof UserForm>['$props']> = {}) {
  return mount(UserForm, {
    props: { warehouses: WAREHOUSES, saving: false, serverError: null, ...props },
  })
}

describe('UserForm', () => {
  it('crea un jefe de bodega con sus bodegas', async () => {
    const wrapper = mountForm()
    await wrapper.find('input[name=name]').setValue('  Jefe Nuevo ')
    await wrapper.find('input[name=email]').setValue('jefe@b.co')
    await wrapper.find('select[name=role]').setValue('WAREHOUSE_MANAGER')
    await wrapper.find('input[name=password]').setValue('Clave-segura-2026')
    await wrapper.find('input[value=wa]').setValue(true)
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')?.[0]).toEqual([
      {
        name: 'Jefe Nuevo',
        email: 'jefe@b.co',
        role: 'WAREHOUSE_MANAGER',
        password: 'Clave-segura-2026',
        active: true,
        warehouseIds: ['wa'],
      },
    ])
  })

  it('valida nombre, correo y contraseña antes de enviar', async () => {
    const wrapper = mountForm()
    await wrapper.find('input[name=email]').setValue('no-es-correo')
    await wrapper.find('input[name=password]').setValue('corta')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    const errors = wrapper.findAll('[role=alert]').map((e) => e.text())
    expect(errors).toEqual([
      'El nombre es obligatorio',
      'Escribe un correo válido',
      'La contraseña debe tener al menos 12 caracteres',
    ])
  })

  it('al editar carga los datos y permite dejar la contraseña vacía', async () => {
    const wrapper = mountForm({ user: EXISTING })
    expect(wrapper.find('h2').text()).toBe('Editar usuario')
    expect(wrapper.find<HTMLInputElement>('input[value=wb]').element.checked).toBe(true)

    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      password: '',
      warehouseIds: ['wb'],
    })
  })

  it('ofrece las bodegas activas y las inactivas solo si ya estaban asignadas', () => {
    expect(mountForm().findAll('input[name=warehouseIds]')).toHaveLength(2)
    const withInactive = mountForm({ user: { ...EXISTING, warehouseIds: ['wz'] } })
    expect(withInactive.text()).toContain('Bodega Z (inactiva)')
  })

  it('al ADMIN y al AUDITOR no se les asignan bodegas', async () => {
    const wrapper = mountForm({ user: EXISTING })
    await wrapper.find('select[name=role]').setValue('AUDITOR')

    expect(wrapper.find('fieldset').exists()).toBe(false)
    expect(wrapper.find('[data-test=global-scope]').text()).toContain('ve todas las bodegas')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ role: 'AUDITOR', warehouseIds: [] })
  })

  it('el propio ADMIN no puede cambiarse el rol ni desactivarse', () => {
    const wrapper = mountForm({ user: { ...EXISTING, role: 'ADMIN' }, isSelf: true })
    expect(wrapper.find('select[name=role]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('input[name=active]').attributes('disabled')).toBeDefined()
  })

  it('muestra el error del servidor y bloquea mientras guarda', () => {
    const wrapper = mountForm({ serverError: 'Ya existe un usuario con ese correo', saving: true })
    expect(wrapper.text()).toContain('Ya existe un usuario con ese correo')
    expect(wrapper.find('button[type=submit]').text()).toBe('Guardando…')
    expect(wrapper.find('button[type=submit]').attributes('disabled')).toBeDefined()
  })
})
