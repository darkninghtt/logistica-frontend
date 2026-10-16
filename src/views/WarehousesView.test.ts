import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import * as api from '@/api/warehouses'
import { ApiError } from '@/api/http'
import WarehousesView from './WarehousesView.vue'
import type { Warehouse } from '@/types/warehouse'

vi.mock('@/api/warehouses')

function warehouse(code: string, active = true): Warehouse {
  return { id: `id-${code}`, code, name: `Bodega ${code}`, active, createdAt: '2026-01-01' }
}

function page(codes: string[], total = codes.length) {
  return { data: codes.map((c) => warehouse(c)), page: 1, pageSize: 10, total }
}

async function mountView() {
  const wrapper = mount(WarehousesView, { global: { plugins: [createPinia()] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

describe('WarehousesView', () => {
  it('muestra el estado de carga mientras espera la respuesta', () => {
    vi.mocked(api.listWarehouses).mockReturnValue(new Promise(() => undefined))
    const wrapper = mount(WarehousesView, { global: { plugins: [createPinia()] } })
    expect(wrapper.text()).toContain('Cargando bodegas')
  })

  it('lista las bodegas', async () => {
    vi.mocked(api.listWarehouses).mockResolvedValue(page(['A', 'B']))
    const wrapper = await mountView()

    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.text()).toContain('Bodega A')
    expect(wrapper.text()).toContain('Activa')
  })

  it('muestra el estado vacío', async () => {
    vi.mocked(api.listWarehouses).mockResolvedValue(page([]))
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('Todavía no hay bodegas')
  })

  it('muestra el error y permite reintentar', async () => {
    vi.mocked(api.listWarehouses)
      .mockRejectedValueOnce(new ApiError('No se pudo conectar con el servidor', null, null, null))
      .mockResolvedValueOnce(page(['A']))
    const wrapper = await mountView()

    expect(wrapper.text()).toContain('No se pudo conectar con el servidor')

    await wrapper.find('[role=alert] button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Bodega A')
  })

  it('crea una bodega desde el formulario y refresca el listado', async () => {
    vi.mocked(api.listWarehouses)
      .mockResolvedValueOnce(page([]))
      .mockResolvedValueOnce(page(['A']))
    vi.mocked(api.createWarehouse).mockResolvedValue(warehouse('A'))
    const wrapper = await mountView()

    await wrapper.find('.header button').trigger('click')
    await wrapper.find('input[name=code]').setValue('A')
    await wrapper.find('input[name=name]').setValue('Bodega A')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(api.createWarehouse).toHaveBeenCalledWith({ code: 'A', name: 'Bodega A', active: true })
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
  })

  it('muestra el error del servidor y deja el formulario abierto', async () => {
    vi.mocked(api.listWarehouses).mockResolvedValue(page(['A']))
    vi.mocked(api.createWarehouse).mockRejectedValue(
      new ApiError('Ya existe una bodega con ese código', 409, 'CONFLICT', 'x'),
    )
    const wrapper = await mountView()

    await wrapper.find('.header button').trigger('click')
    await wrapper.find('input[name=code]').setValue('A')
    await wrapper.find('input[name=name]').setValue('Otra')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.text()).toContain('Ya existe una bodega con ese código')
  })

  it('edita una bodega existente', async () => {
    vi.mocked(api.listWarehouses).mockResolvedValue(page(['A']))
    vi.mocked(api.updateWarehouse).mockResolvedValue(warehouse('A'))
    const wrapper = await mountView()

    await wrapper.find('tbody button').trigger('click')
    await wrapper.find('input[name=name]').setValue('Nombre nuevo')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(api.updateWarehouse).toHaveBeenCalledWith('id-A', {
      code: 'A',
      name: 'Nombre nuevo',
      active: true,
    })
  })

  it('desactiva una bodega con el botón de la fila', async () => {
    vi.mocked(api.listWarehouses).mockResolvedValue(page(['A']))
    vi.mocked(api.updateWarehouse).mockResolvedValue(warehouse('A', false))
    const wrapper = await mountView()

    await wrapper.findAll('tbody button')[1]?.trigger('click')
    await flushPromises()

    expect(api.updateWarehouse).toHaveBeenCalledWith('id-A', {
      code: 'A',
      name: 'Bodega A',
      active: false,
    })
  })

  it('pagina con los botones Anterior y Siguiente', async () => {
    vi.mocked(api.listWarehouses).mockResolvedValue(page(['A'], 25))
    const wrapper = await mountView()

    expect(wrapper.text()).toContain('Página 1 de 3')
    const next = wrapper.findAll('.pager button')[1]
    await next?.trigger('click')

    expect(api.listWarehouses).toHaveBeenLastCalledWith(2, 10)
  })
})
