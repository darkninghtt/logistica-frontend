import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WarehouseForm from './WarehouseForm.vue'

describe('WarehouseForm', () => {
  it('no envía y muestra errores si faltan código y nombre', async () => {
    const wrapper = mount(WarehouseForm, { props: { saving: false, serverError: null } })

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('El código es obligatorio')
    expect(wrapper.text()).toContain('El nombre es obligatorio')
  })

  it('envía los datos recortados al crear', async () => {
    const wrapper = mount(WarehouseForm, { props: { saving: false, serverError: null } })

    await wrapper.find('input[name=code]').setValue('  BOD-A ')
    await wrapper.find('input[name=name]').setValue(' Bodega A ')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([[{ code: 'BOD-A', name: 'Bodega A', active: true }]])
  })

  it('al editar carga los valores de la bodega', () => {
    const wrapper = mount(WarehouseForm, {
      props: {
        warehouse: { id: '1', code: 'A', name: 'Bodega A', active: false, createdAt: '' },
        saving: false,
        serverError: null,
      },
    })

    expect(wrapper.text()).toContain('Editar bodega')
    expect(wrapper.find<HTMLInputElement>('input[name=code]').element.value).toBe('A')
    expect(wrapper.find<HTMLInputElement>('input[name=active]').element.checked).toBe(false)
  })

  it('muestra el error del servidor', () => {
    const wrapper = mount(WarehouseForm, {
      props: { saving: false, serverError: 'Ya existe una bodega con ese código' },
    })
    expect(wrapper.text()).toContain('Ya existe una bodega con ese código')
  })

  it('deshabilita los campos mientras guarda', () => {
    const wrapper = mount(WarehouseForm, { props: { saving: true, serverError: null } })
    expect(wrapper.find('button[type=submit]').attributes('disabled')).toBeDefined()
  })
})
