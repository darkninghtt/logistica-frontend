import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TransferReceiveForm from './TransferReceiveForm.vue'
import type { TransferItem } from '@/types/transfer'

const items: TransferItem[] = [
  {
    productId: 'p1',
    productSku: 'S1',
    productName: 'Tornillo',
    quantitySent: 8,
    quantityReceived: null,
  },
  {
    productId: 'p2',
    productSku: 'S2',
    productName: 'Tuerca',
    quantitySent: 5,
    quantityReceived: null,
  },
]

function mountForm(saving = false) {
  return mount(TransferReceiveForm, { props: { items, saving } })
}

async function fill(wrapper: ReturnType<typeof mountForm>, p1: string, p2: string) {
  await wrapper.find('input[name=received-p1]').setValue(p1)
  await wrapper.find('input[name=received-p2]').setValue(p2)
}

describe('TransferReceiveForm', () => {
  it('muestra lo enviado como referencia y los campos vacíos', () => {
    const wrapper = mountForm()
    const rows = wrapper.findAll('tbody tr').map((row) => row.findAll('td')[1]?.text())
    expect(rows).toEqual(['8', '5'])
    expect(wrapper.find<HTMLInputElement>('input[name=received-p1]').element.value).toBe('')
  })

  it('no envía si falta declarar algún producto', async () => {
    const wrapper = mountForm()
    await wrapper.find('input[name=received-p1]').setValue('8')

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('Indica la cantidad recibida')
  })

  it.each(['-1', '1.5', 'siete', '1000000001'])('rechaza la cantidad "%s"', async (value) => {
    const wrapper = mountForm()
    await fill(wrapper, value, '5')

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.find('[role=alert]').exists()).toBe(true)
  })

  it('envía todos los ítems con la cantidad como número (cero incluido)', async () => {
    const wrapper = mountForm()
    await fill(wrapper, ' 7 ', '0')

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([
      [
        {
          items: [
            { productId: 'p1', receivedQuantity: 7 },
            { productId: 'p2', receivedQuantity: 0 },
          ],
        },
      ],
    ])
  })

  it('avisa de la discrepancia solo si algo no coincide', async () => {
    const wrapper = mountForm()
    await fill(wrapper, '8', '5')
    expect(wrapper.find('[data-test=discrepancy-warning]').exists()).toBe(false)

    await fill(wrapper, '7', '5')
    expect(wrapper.find('[data-test=discrepancy-warning]').exists()).toBe(true)
  })

  it('mientras guarda, el botón queda deshabilitado', () => {
    const button = mountForm(true).find<HTMLButtonElement>('button[type=submit]')
    expect(button.element.disabled).toBe(true)
    expect(button.text()).toBe('Procesando…')
  })
})
