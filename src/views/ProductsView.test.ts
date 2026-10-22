import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import * as api from '@/api/products'
import { ApiError } from '@/api/http'
import ProductsView from './ProductsView.vue'
import { piniaSignedInAs } from '@/testing'
import type { Role } from '@/types/auth'
import type { Product } from '@/types/product'

vi.mock('@/api/products')

function product(sku: string): Product {
  return { id: `id-${sku}`, sku, name: `Producto ${sku}`, unit: 'un', createdAt: '2026-01-01' }
}

function page(skus: string[], total = skus.length) {
  return { data: skus.map(product), page: 1, pageSize: 10, total }
}

async function mountView(role: Role = 'ADMIN') {
  const wrapper = mount(ProductsView, { global: { plugins: [piniaSignedInAs(role)] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

describe('ProductsView', () => {
  it('muestra el estado de carga mientras espera la respuesta', () => {
    vi.mocked(api.listProducts).mockReturnValue(new Promise(() => undefined))
    const wrapper = mount(ProductsView, { global: { plugins: [createPinia()] } })
    expect(wrapper.text()).toContain('Cargando productos')
  })

  it('lista los productos', async () => {
    vi.mocked(api.listProducts).mockResolvedValue(page(['A', 'B']))
    const wrapper = await mountView()

    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.text()).toContain('Producto A')
  })

  it('muestra el estado vacío', async () => {
    vi.mocked(api.listProducts).mockResolvedValue(page([]))
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('Todavía no hay productos')
  })

  it('muestra el error y permite reintentar', async () => {
    vi.mocked(api.listProducts)
      .mockRejectedValueOnce(new ApiError('No se pudo conectar con el servidor', null, null, null))
      .mockResolvedValueOnce(page(['A']))
    const wrapper = await mountView()

    expect(wrapper.text()).toContain('No se pudo conectar con el servidor')

    await wrapper.find('[role=alert] button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Producto A')
  })

  it('crea un producto desde el formulario y refresca el listado', async () => {
    vi.mocked(api.listProducts)
      .mockResolvedValueOnce(page([]))
      .mockResolvedValueOnce(page(['A']))
    vi.mocked(api.createProduct).mockResolvedValue(product('A'))
    const wrapper = await mountView()

    await wrapper.find('.header button').trigger('click')
    await wrapper.find('input[name=sku]').setValue('A')
    await wrapper.find('input[name=name]').setValue('Producto A')
    await wrapper.find('input[name=unit]').setValue('un')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(api.createProduct).toHaveBeenCalledWith({ sku: 'A', name: 'Producto A', unit: 'un' })
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
  })

  it('muestra el error de SKU repetido y deja el formulario abierto', async () => {
    vi.mocked(api.listProducts).mockResolvedValue(page(['A']))
    vi.mocked(api.createProduct).mockRejectedValue(
      new ApiError('Ya existe un producto con ese SKU', 409, 'CONFLICT', 'x'),
    )
    const wrapper = await mountView()

    await wrapper.find('.header button').trigger('click')
    await wrapper.find('input[name=sku]').setValue('A')
    await wrapper.find('input[name=name]').setValue('Otro')
    await wrapper.find('input[name=unit]').setValue('un')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.text()).toContain('Ya existe un producto con ese SKU')
  })

  it('edita un producto existente', async () => {
    vi.mocked(api.listProducts).mockResolvedValue(page(['A']))
    vi.mocked(api.updateProduct).mockResolvedValue(product('A'))
    const wrapper = await mountView()

    await wrapper.find('tbody button').trigger('click')
    await wrapper.find('input[name=name]').setValue('Nombre nuevo')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(api.updateProduct).toHaveBeenCalledWith('id-A', {
      sku: 'A',
      name: 'Nombre nuevo',
      unit: 'un',
    })
  })

  it('pagina con los botones Anterior y Siguiente', async () => {
    vi.mocked(api.listProducts).mockResolvedValue(page(['A'], 25))
    const wrapper = await mountView()

    expect(wrapper.text()).toContain('Página 1 de 3')
    await wrapper.findAll('.pager button')[1]?.trigger('click')

    expect(api.listProducts).toHaveBeenLastCalledWith(2, 10)
  })
})

describe('ProductsView según el rol', () => {
  it.each(['WAREHOUSE_MANAGER', 'OPERATOR', 'AUDITOR'] as const)(
    '%s ve la lista pero sin crear ni editar',
    async (role) => {
      vi.mocked(api.listProducts).mockResolvedValue(page(['A']))
      const wrapper = await mountView(role)

      expect(wrapper.findAll('tbody tr')).toHaveLength(1)
      expect(wrapper.text()).not.toContain('Nuevo producto')
      expect(wrapper.text()).not.toContain('Editar')
      expect(wrapper.text()).not.toContain('Acciones')
    },
  )

  it('el ADMIN conserva crear y editar', async () => {
    vi.mocked(api.listProducts).mockResolvedValue(page(['A']))
    const wrapper = await mountView('ADMIN')
    expect(wrapper.text()).toContain('Nuevo producto')
    expect(wrapper.text()).toContain('Editar')
  })

  it('un 403 de la API se muestra con un mensaje claro y permite reintentar', async () => {
    vi.mocked(api.listProducts).mockRejectedValue(
      new ApiError('No tienes permiso para realizar esta acción', 403, 'FORBIDDEN', 'c-1'),
    )
    const wrapper = await mountView('OPERATOR')
    expect(wrapper.find('[role=alert]').text()).toContain('No tienes permiso')
    expect(wrapper.find('[role=alert] button').text()).toBe('Reintentar')
  })
})
