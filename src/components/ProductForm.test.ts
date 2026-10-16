import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductForm from './ProductForm.vue'

describe('ProductForm', () => {
  it('no envía y muestra errores si faltan SKU, nombre y unidad', async () => {
    const wrapper = mount(ProductForm, { props: { saving: false, serverError: null } })

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('El SKU es obligatorio')
    expect(wrapper.text()).toContain('El nombre es obligatorio')
    expect(wrapper.text()).toContain('La unidad es obligatoria')
  })

  it('envía los datos recortados al crear', async () => {
    const wrapper = mount(ProductForm, { props: { saving: false, serverError: null } })

    await wrapper.find('input[name=sku]').setValue('  SKU-1 ')
    await wrapper.find('input[name=name]').setValue(' Tornillo ')
    await wrapper.find('input[name=unit]').setValue(' un ')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([[{ sku: 'SKU-1', name: 'Tornillo', unit: 'un' }]])
  })

  it('al editar carga los valores del producto', () => {
    const wrapper = mount(ProductForm, {
      props: {
        product: { id: '1', sku: 'A', name: 'Tornillo', unit: 'kg', createdAt: '' },
        saving: false,
        serverError: null,
      },
    })

    expect(wrapper.text()).toContain('Editar producto')
    expect(wrapper.find<HTMLInputElement>('input[name=sku]').element.value).toBe('A')
    expect(wrapper.find<HTMLInputElement>('input[name=unit]').element.value).toBe('kg')
  })

  it('muestra el error del servidor', () => {
    const wrapper = mount(ProductForm, {
      props: { saving: false, serverError: 'Ya existe un producto con ese SKU' },
    })
    expect(wrapper.text()).toContain('Ya existe un producto con ese SKU')
  })

  it('deshabilita el envío mientras guarda', () => {
    const wrapper = mount(ProductForm, { props: { saving: true, serverError: null } })
    expect(wrapper.find('button[type=submit]').attributes('disabled')).toBeDefined()
  })
})
