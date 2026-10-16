import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StockEntryForm from './StockEntryForm.vue'
import type { Product } from '@/types/product'
import type { Warehouse } from '@/types/warehouse'

const warehouses: Warehouse[] = [
  { id: 'w1', code: 'A', name: 'Bodega A', active: true, createdAt: '' },
  { id: 'w2', code: 'B', name: 'Bodega B', active: false, createdAt: '' },
]
const products: Product[] = [{ id: 'p1', sku: 'S1', name: 'Tornillo', unit: 'un', createdAt: '' }]

function mountForm(serverError: string | null = null) {
  return mount(StockEntryForm, { props: { warehouses, products, saving: false, serverError } })
}

async function fill(
  wrapper: ReturnType<typeof mountForm>,
  values: { quantity: string; unitCost: string },
) {
  await wrapper.find('select[name=warehouseId]').setValue('w1')
  await wrapper.find('select[name=productId]').setValue('p1')
  await wrapper.find('input[name=quantity]').setValue(values.quantity)
  await wrapper.find('input[name=unitCost]').setValue(values.unitCost)
  await wrapper.find('form').trigger('submit')
}

describe('StockEntryForm', () => {
  it('no envía y muestra errores si está vacío', async () => {
    const wrapper = mountForm()

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('Elige una bodega')
    expect(wrapper.text()).toContain('Elige un producto')
    expect(wrapper.text()).toContain('La cantidad es obligatoria')
    expect(wrapper.text()).toContain('El costo unitario es obligatorio')
  })

  it('envía la cantidad como número y el costo como texto', async () => {
    const wrapper = mountForm()

    await fill(wrapper, { quantity: ' 10 ', unitCost: ' 100.50 ' })

    expect(wrapper.emitted('submit')).toEqual([
      [{ warehouseId: 'w1', productId: 'p1', quantity: 10, unitCost: '100.50' }],
    ])
  })

  it.each(['0', '-3', '1.5', 'abc', '1000000001'])('rechaza la cantidad "%s"', async (quantity) => {
    const wrapper = mountForm()

    await fill(wrapper, { quantity, unitCost: '10' })

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.find('[role=alert]').exists()).toBe(true)
  })

  it.each(['0', '-1', '1.12345', 'barato', '12345678901'])(
    'rechaza el costo "%s"',
    async (unitCost) => {
      const wrapper = mountForm()

      await fill(wrapper, { quantity: '1', unitCost })

      expect(wrapper.emitted('submit')).toBeUndefined()
      expect(wrapper.find('[role=alert]').exists()).toBe(true)
    },
  )

  it('marca las bodegas inactivas en la lista', () => {
    const wrapper = mountForm()
    const labels = wrapper.findAll('select[name=warehouseId] option').map((o) => o.text())
    expect(labels).toContain('B · Bodega B (inactiva)')
  })

  it('muestra el error del servidor', () => {
    const wrapper = mountForm('La bodega no existe')
    expect(wrapper.text()).toContain('La bodega no existe')
  })

  it('reset limpia cantidad y costo pero conserva bodega y producto', async () => {
    const wrapper = mountForm()
    await fill(wrapper, { quantity: '5', unitCost: '9' })

    wrapper.vm.reset()
    await wrapper.vm.$nextTick()

    expect(wrapper.find<HTMLInputElement>('input[name=quantity]').element.value).toBe('')
    expect(wrapper.find<HTMLInputElement>('input[name=unitCost]').element.value).toBe('')
    expect(wrapper.find<HTMLSelectElement>('select[name=warehouseId]').element.value).toBe('w1')
  })
})
