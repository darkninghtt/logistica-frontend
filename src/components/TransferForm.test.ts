import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TransferForm from './TransferForm.vue'
import type { Product } from '@/types/product'
import type { WarehouseRef } from '@/types/transfer'

const A: WarehouseRef = { id: 'wa', code: 'A', name: 'Bodega A' }
const B: WarehouseRef = { id: 'wb', code: 'B', name: 'Bodega B' }
const products: Product[] = [
  { id: 'p1', sku: 'S1', name: 'Tornillo', unit: 'un', createdAt: '' },
  { id: 'p2', sku: 'S2', name: 'Tuerca', unit: 'un', createdAt: '' },
]

function mountForm(serverError: string | null = null, saving = false, origins = [A]) {
  return mount(TransferForm, {
    props: { origins, destinations: [A, B], products, saving, serverError },
  })
}

type Wrapper = ReturnType<typeof mountForm>

async function fillBasics(wrapper: Wrapper) {
  await wrapper.find('select[name=destinationWarehouseId]').setValue('wb')
  await wrapper.find('select[name=productId-0]').setValue('p1')
  await wrapper.find('input[name=quantity-0]').setValue('8')
}

describe('TransferForm', () => {
  it('no envía y muestra errores si está vacío', async () => {
    const wrapper = mountForm(null, false, [A, B])

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('Elige la bodega de origen')
    expect(wrapper.text()).toContain('Elige la bodega de destino')
    expect(wrapper.text()).toContain('Elige un producto')
  })

  it('con una sola bodega asignada la preselecciona como origen', () => {
    const wrapper = mountForm()
    expect(wrapper.find<HTMLSelectElement>('select[name=originWarehouseId]').element.value).toBe(
      'wa',
    )
  })

  it('no ofrece como destino la bodega elegida como origen', async () => {
    const wrapper = mountForm(null, false, [A, B])
    await wrapper.find('select[name=originWarehouseId]').setValue('wa')

    const destinations = wrapper
      .findAll('select[name=destinationWarehouseId] option')
      .map((o) => o.text())
      .slice(1)

    expect(destinations).toEqual(['B · Bodega B'])
  })

  it('pide la cantidad cuando ya se eligió el producto', async () => {
    const wrapper = mountForm()
    await wrapper.find('select[name=productId-0]').setValue('p1')

    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain('La cantidad es obligatoria')
  })

  it.each([['0'], ['-3'], ['2.5'], ['abc'], ['1000000001']])(
    'rechaza la cantidad %s',
    async (quantity) => {
      const wrapper = mountForm()
      await fillBasics(wrapper)
      await wrapper.find('input[name=quantity-0]').setValue(quantity)

      await wrapper.find('form').trigger('submit')

      expect(wrapper.emitted('submit')).toBeUndefined()
      expect(wrapper.find('[role=alert]').exists()).toBe(true)
    },
  )

  it('envía el borrador con cantidades numéricas y sin nota si está vacía', async () => {
    const wrapper = mountForm()
    await fillBasics(wrapper)

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([
      [
        {
          originWarehouseId: 'wa',
          destinationWarehouseId: 'wb',
          items: [{ productId: 'p1', quantity: 8 }],
        },
      ],
    ])
  })

  it('agrega y quita productos, y envía la nota recortada', async () => {
    const wrapper = mountForm()
    await fillBasics(wrapper)
    await wrapper.find('textarea[name=note]').setValue('  urgente  ')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Agregar producto')
      ?.trigger('click')
    await wrapper.find('select[name=productId-1]').setValue('p2')
    await wrapper.find('input[name=quantity-1]').setValue('3')

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({
      originWarehouseId: 'wa',
      destinationWarehouseId: 'wb',
      items: [
        { productId: 'p1', quantity: 8 },
        { productId: 'p2', quantity: 3 },
      ],
      note: 'urgente',
    })

    await wrapper.find('button[aria-label="Quitar el producto 2"]').trigger('click')
    expect(wrapper.find('select[name=productId-1]').exists()).toBe(false)
  })

  it('no deja quitar el único producto', () => {
    const wrapper = mountForm()
    expect(
      wrapper.find('button[aria-label="Quitar el producto 1"]').attributes('disabled'),
    ).toBeDefined()
  })

  it('rechaza un producto repetido', async () => {
    const wrapper = mountForm()
    await fillBasics(wrapper)
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Agregar producto')
      ?.trigger('click')
    await wrapper.find('select[name=productId-1]').setValue('p1')
    await wrapper.find('input[name=quantity-1]').setValue('2')

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('Ese producto ya está en el traspaso')
  })

  it('rechaza una nota demasiado larga', async () => {
    const wrapper = mountForm()
    await fillBasics(wrapper)
    await wrapper.find('textarea[name=note]').setValue('x'.repeat(501))

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('La nota no puede superar 500 caracteres')
  })

  it('muestra el error del servidor y deshabilita los campos mientras guarda', () => {
    const failed = mountForm('Algún producto del traspaso no existe')
    expect(failed.text()).toContain('Algún producto del traspaso no existe')

    const saving = mountForm(null, true)
    expect(saving.find('button[type=submit]').text()).toBe('Guardando…')
    expect(saving.find('button[type=submit]').attributes('disabled')).toBeDefined()
  })

  it('Cancelar avisa a la vista', async () => {
    const wrapper = mountForm()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Cancelar')
      ?.trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
