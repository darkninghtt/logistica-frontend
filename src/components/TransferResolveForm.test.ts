import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TransferResolveForm from './TransferResolveForm.vue'

function mountForm(saving = false) {
  return mount(TransferResolveForm, { props: { saving } })
}

describe('TransferResolveForm', () => {
  it('el motivo es obligatorio (espacios no cuentan)', async () => {
    const wrapper = mountForm()
    await wrapper.find('textarea').setValue('   ')

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('El motivo es obligatorio')
  })

  it('rechaza un motivo de más de 500 caracteres', async () => {
    const wrapper = mountForm()
    await wrapper.find('textarea').setValue('x'.repeat(501))

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('Máximo 500 caracteres')
  })

  it('envía el motivo recortado', async () => {
    const wrapper = mountForm()
    await wrapper.find('textarea').setValue('  Caja rota en el camión ')

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([['Caja rota en el camión']])
  })

  it('mientras guarda, el botón queda deshabilitado', () => {
    const button = mountForm(true).find<HTMLButtonElement>('button[type=submit]')
    expect(button.element.disabled).toBe(true)
  })
})
