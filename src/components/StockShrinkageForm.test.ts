import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StockShrinkageForm from './StockShrinkageForm.vue'
import type { Product } from '@/types/product'
import type { Warehouse } from '@/types/warehouse'

const warehouses: Warehouse[] = [
  { id: 'w1', code: 'A', name: 'Bodega A', active: true, createdAt: '' },
]
const products: Product[] = [{ id: 'p1', sku: 'S1', name: 'Tornillo', unit: 'un', createdAt: '' }]

function mountForm(serverError: string | null = null, saving = false) {
  return mount(StockShrinkageForm, { props: { warehouses, products, saving, serverError } })
}

async function fill(
  wrapper: ReturnType<typeof mountForm>,
  values: { quantity: string; reason: string; note?: string },
) {
  await wrapper.find('select[name=warehouseId]').setValue('w1')
  await wrapper.find('select[name=productId]').setValue('p1')
  await wrapper.find('input[name=quantity]').setValue(values.quantity)
  await wrapper.find('select[name=reason]').setValue(values.reason)
  await wrapper.find('textarea[name=note]').setValue(values.note ?? '')
  await wrapper.find('form').trigger('submit')
}

describe('StockShrinkageForm', () => {
  it('no envía y muestra errores si está vacío', async () => {
    const wrapper = mountForm()

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('Elige una bodega')
    expect(wrapper.text()).toContain('Elige un producto')
    expect(wrapper.text()).toContain('La cantidad es obligatoria')
    expect(wrapper.text()).toContain('Elige un motivo')
  })

  it('ofrece los cuatro motivos en español', () => {
    const wrapper = mountForm()
    const labels = wrapper
      .findAll('select[name=reason] option')
      .map((o) => o.text())
      .slice(1)
    expect(labels).toEqual(['Daño', 'Vencimiento', 'Robo', 'Ajuste de conteo'])
  })

  it('envía la cantidad como número y el código del motivo, sin nota si está vacía', async () => {
    const wrapper = mountForm()

    await fill(wrapper, { quantity: ' 2 ', reason: 'DAMAGE', note: '   ' })

    expect(wrapper.emitted('submit')).toEqual([
      [{ warehouseId: 'w1', productId: 'p1', quantity: 2, reason: 'DAMAGE' }],
    ])
  })

  it('envía la nota recortada si la hay', async () => {
    const wrapper = mountForm()

    await fill(wrapper, { quantity: '1', reason: 'EXPIRED', note: ' lote 45 ' })

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      reason: 'EXPIRED',
      note: 'lote 45',
    })
  })

  it.each(['0', '-3', '1.5', 'abc', '1000000001'])('rechaza la cantidad "%s"', async (quantity) => {
    const wrapper = mountForm()

    await fill(wrapper, { quantity, reason: 'THEFT' })

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.find('[role=alert]').exists()).toBe(true)
  })

  it('rechaza una nota de más de 500 caracteres', async () => {
    const wrapper = mountForm()

    await fill(wrapper, { quantity: '1', reason: 'THEFT', note: 'x'.repeat(501) })

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('La nota no puede superar 500 caracteres')
  })

  it('muestra el error del servidor', () => {
    const wrapper = mountForm('No hay stock suficiente en la bodega para registrar la merma')
    expect(wrapper.text()).toContain('No hay stock suficiente')
  })

  it('mientras guarda, el botón queda deshabilitado', () => {
    const wrapper = mountForm(null, true)
    const button = wrapper.find<HTMLButtonElement>('button[type=submit]')
    expect(button.element.disabled).toBe(true)
    expect(button.text()).toBe('Registrando…')
  })

  it('reset limpia cantidad, motivo y nota pero conserva bodega y producto', async () => {
    const wrapper = mountForm()
    await fill(wrapper, { quantity: '5', reason: 'DAMAGE', note: 'golpe' })

    wrapper.vm.reset()
    await wrapper.vm.$nextTick()

    expect(wrapper.find<HTMLInputElement>('input[name=quantity]').element.value).toBe('')
    expect(wrapper.find<HTMLSelectElement>('select[name=reason]').element.value).toBe('')
    expect(wrapper.find<HTMLTextAreaElement>('textarea[name=note]').element.value).toBe('')
    expect(wrapper.find<HTMLSelectElement>('select[name=warehouseId]').element.value).toBe('w1')
  })
})
