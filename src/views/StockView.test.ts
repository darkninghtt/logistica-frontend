import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import * as stockApi from '@/api/stock'
import * as warehousesApi from '@/api/warehouses'
import * as productsApi from '@/api/products'
import { ApiError } from '@/api/http'
import StockView from './StockView.vue'
import { piniaSignedInAs } from '@/testing'
import type { Role } from '@/types/auth'
import type { StockLevelItem, StockMovementItem } from '@/types/stock'

vi.mock('@/api/stock')
vi.mock('@/api/warehouses')
vi.mock('@/api/products')

const WAREHOUSE = { id: 'w-1', code: 'A', name: 'Bodega A', active: true, createdAt: '' }
const PRODUCT = { id: 'p-A', sku: 'SKU-1', name: 'Tornillo', unit: 'un', createdAt: '' }

const LEVEL: StockLevelItem = {
  productId: 'p-A',
  warehouseId: 'w-1',
  quantity: 20,
  avgCost: '110.0000',
  totalValue: '2200.0000',
  productSku: 'SKU-1',
  productName: 'Tornillo',
  productUnit: 'un',
}

function movement(id: string, balanceQty: number, balanceAvgCost: string): StockMovementItem {
  return {
    id,
    productId: 'p-A',
    warehouseId: 'w-1',
    type: 'ENTRY',
    quantity: 10,
    unitCost: '120.0000',
    balanceQty,
    balanceAvgCost,
    reason: null,
    transferId: null,
    createdBy: 'u-1',
    createdAt: '2026-01-01T10:00:00.000Z',
    productSku: 'SKU-1',
    productName: 'Tornillo',
  }
}

function pageOf<T>(data: T[], total = data.length) {
  return { data, page: 1, pageSize: 10, total }
}

async function mountView(role: Role = 'ADMIN') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: StockView }],
  })
  const wrapper = mount(StockView, { global: { plugins: [piniaSignedInAs(role), router] } })
  await flushPromises()
  return wrapper
}

async function chooseWarehouse(wrapper: Awaited<ReturnType<typeof mountView>>) {
  await wrapper.find('select[name=warehouse]').setValue('w-1')
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  vi.mocked(warehousesApi.listWarehouses).mockResolvedValue(pageOf([WAREHOUSE]))
  vi.mocked(productsApi.listProducts).mockResolvedValue(pageOf([PRODUCT]))
  vi.mocked(stockApi.listStockLevels).mockResolvedValue(pageOf([LEVEL]))
  vi.mocked(stockApi.listStockMovements).mockResolvedValue(
    pageOf([movement('2', 20, '110.0000'), movement('1', 10, '100.0000')]),
  )
})

describe('StockView', () => {
  it('muestra el estado de carga mientras llegan las bodegas', () => {
    vi.mocked(warehousesApi.listWarehouses).mockReturnValue(new Promise(() => undefined))
    const wrapper = mount(StockView, {
      global: {
        plugins: [
          createPinia(),
          createRouter({
            history: createMemoryHistory(),
            routes: [{ path: '/', component: StockView }],
          }),
        ],
      },
    })
    expect(wrapper.text()).toContain('Cargando bodegas')
  })

  it('pide elegir una bodega antes de mostrar datos', async () => {
    const wrapper = await mountView()

    expect(wrapper.text()).toContain('Selecciona una bodega para ver')
    expect(stockApi.listStockLevels).not.toHaveBeenCalled()
  })

  it('avisa si todavía no hay bodegas', async () => {
    vi.mocked(warehousesApi.listWarehouses).mockResolvedValue(pageOf([]))
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('Todavía no hay bodegas')
  })

  it('muestra el error de las bodegas y permite reintentar', async () => {
    vi.mocked(warehousesApi.listWarehouses)
      .mockRejectedValueOnce(new ApiError('No se pudo conectar con el servidor', null, null, null))
      .mockResolvedValueOnce(pageOf([WAREHOUSE]))
    const wrapper = await mountView()

    expect(wrapper.text()).toContain('No se pudo conectar con el servidor')
    await wrapper.find('[role=alert] button').trigger('click')
    await flushPromises()

    expect(wrapper.find('select[name=warehouse]').exists()).toBe(true)
  })

  it('al elegir una bodega muestra las existencias con cantidad, costo promedio y valor total', async () => {
    const wrapper = await mountView()
    await chooseWarehouse(wrapper)

    const cells = wrapper.findAll('[data-test=levels-table] tbody td').map((c) => c.text())
    expect(cells).toEqual(['SKU-1', 'Tornillo', 'un', '20', '110.0000', '2200.0000'])
  })

  it('muestra el historial con el saldo y el costo después de cada movimiento', async () => {
    const wrapper = await mountView()
    await chooseWarehouse(wrapper)

    const rows = wrapper.findAll('[data-test=movements-table] tbody tr')
    expect(rows).toHaveLength(2)
    const latest = rows[0]?.findAll('td').map((c) => c.text()) ?? []
    expect(latest.slice(1)).toEqual([
      'SKU-1',
      'Tornillo',
      'Entrada',
      '',
      '+10',
      '120.0000',
      '20',
      '110.0000',
    ])
  })

  it('muestra los tipos nuevos en español, con el signo de la cantidad y el motivo', async () => {
    const typed = (
      id: string,
      type: StockMovementItem['type'],
      reason: string | null,
    ): StockMovementItem => ({ ...movement(id, 10, '110.0000'), type, reason, quantity: 2 })
    vi.mocked(stockApi.listStockMovements).mockResolvedValue(
      pageOf([
        typed('6', 'ADJUSTMENT_IN', 'Conteo físico al recibir'),
        typed('5', 'TRANSIT_SHRINKAGE', 'Caja rota en el camión'),
        typed('4', 'SHRINKAGE', 'DAMAGE: estiba caída'),
        typed('3', 'SHRINKAGE', 'EXPIRED'),
        typed('2', 'TRANSFER_IN', null),
        typed('1', 'TRANSFER_OUT', null),
      ]),
    )
    const wrapper = await mountView()
    await chooseWarehouse(wrapper)

    const rows = wrapper.findAll('[data-test=movements-table] tbody tr').map((row) =>
      row
        .findAll('td')
        .map((c) => c.text())
        .slice(3, 6),
    )
    expect(rows).toEqual([
      ['Ajuste de entrada', 'Conteo físico al recibir', '+2'],
      ['Merma en tránsito', 'Caja rota en el camión', '2'],
      ['Merma', 'Daño: estiba caída', '-2'],
      ['Merma', 'Vencimiento', '-2'],
      ['Entrada por traspaso', '', '+2'],
      ['Salida por traspaso', '', '-2'],
    ])
  })

  it('filtra el historial por producto', async () => {
    const wrapper = await mountView()
    await chooseWarehouse(wrapper)

    await wrapper.find('select[name=product]').setValue('p-A')
    await flushPromises()

    expect(stockApi.listStockMovements).toHaveBeenLastCalledWith('w-1', 'p-A', 1, 10)
  })

  it('muestra los estados vacíos de existencias e historial', async () => {
    vi.mocked(stockApi.listStockLevels).mockResolvedValue(pageOf([]))
    vi.mocked(stockApi.listStockMovements).mockResolvedValue(pageOf([]))
    const wrapper = await mountView()
    await chooseWarehouse(wrapper)

    expect(wrapper.find('[data-test=levels-empty]').text()).toContain(
      'todavía no tiene existencias',
    )
    expect(wrapper.find('[data-test=movements-empty]').text()).toContain('No hay movimientos')
  })

  it('muestra el error de las existencias y permite reintentar', async () => {
    vi.mocked(stockApi.listStockLevels)
      .mockRejectedValueOnce(new ApiError('Error interno del servidor', 500, 'INTERNAL_ERROR', 'x'))
      .mockResolvedValueOnce(pageOf([LEVEL]))
    const wrapper = await mountView()
    await chooseWarehouse(wrapper)

    expect(wrapper.find('[data-test=levels-error]').text()).toContain('Error interno del servidor')
    await wrapper.find('[data-test=levels-error] button').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test=levels-table]').exists()).toBe(true)
  })

  it('muestra el error del historial sin ocultar las existencias', async () => {
    vi.mocked(stockApi.listStockMovements).mockRejectedValue(
      new ApiError('Error interno del servidor', 500, 'INTERNAL_ERROR', 'x'),
    )
    const wrapper = await mountView()
    await chooseWarehouse(wrapper)

    expect(wrapper.find('[data-test=movements-error]').exists()).toBe(true)
    expect(wrapper.find('[data-test=levels-table]').exists()).toBe(true)
  })

  it('pagina el historial', async () => {
    vi.mocked(stockApi.listStockMovements).mockResolvedValue(
      pageOf([movement('2', 20, '110.0000')], 25),
    )
    const wrapper = await mountView()
    await chooseWarehouse(wrapper)

    expect(wrapper.text()).toContain('Página 1 de 3 (25 movimientos)')
    const next = wrapper.findAll('nav[aria-label="Paginación del historial"] button')[1]
    await next?.trigger('click')

    expect(stockApi.listStockMovements).toHaveBeenLastCalledWith('w-1', undefined, 2, 10)
  })
})

describe('StockView según el rol (costos)', () => {
  const LEVEL_NO_COST: StockLevelItem = {
    productId: 'p-A',
    warehouseId: 'w-1',
    quantity: 20,
    productSku: 'SKU-1',
    productName: 'Tornillo',
    productUnit: 'un',
  }
  const MOVEMENT_NO_COST: StockMovementItem = {
    id: '1',
    productId: 'p-A',
    warehouseId: 'w-1',
    type: 'ENTRY',
    quantity: 10,
    balanceQty: 20,
    reason: null,
    transferId: null,
    createdBy: 'u-1',
    createdAt: '2026-01-01T10:00:00.000Z',
    productSku: 'SKU-1',
    productName: 'Tornillo',
  }

  it.each(['ADMIN', 'AUDITOR', 'WAREHOUSE_MANAGER'] as const)(
    '%s ve las columnas de costo',
    async (role) => {
      const wrapper = await mountView(role)
      await chooseWarehouse(wrapper)

      const text = wrapper.text()
      expect(text).toContain('Costo promedio')
      expect(text).toContain('Valor total')
      expect(text).toContain('Costo unitario')
      expect(text).toContain('110.0000')
    },
  )

  it('si la API no envía costos (OPERATOR), no se muestran las columnas de costo', async () => {
    vi.mocked(stockApi.listStockLevels).mockResolvedValue(pageOf([LEVEL_NO_COST]))
    vi.mocked(stockApi.listStockMovements).mockResolvedValue(pageOf([MOVEMENT_NO_COST]))
    const wrapper = await mountView('OPERATOR')
    await chooseWarehouse(wrapper)

    const text = wrapper.text()
    expect(wrapper.find('[data-test=levels-table]').exists()).toBe(true)
    expect(wrapper.find('[data-test=movements-table]').exists()).toBe(true)
    expect(text).toContain('Cantidad')
    expect(text).toContain('Saldo')
    expect(text).not.toContain('Costo')
    expect(text).not.toContain('Valor total')
    expect(text).not.toContain('undefined')
  })

  it('un 403 al cargar las existencias se muestra con el mensaje de la API', async () => {
    vi.mocked(stockApi.listStockLevels).mockRejectedValue(
      new ApiError('No tienes acceso a esa bodega', 403, 'FORBIDDEN', 'c-1'),
    )
    const wrapper = await mountView('OPERATOR')
    await chooseWarehouse(wrapper)
    expect(wrapper.find('[data-test=levels-error]').text()).toContain(
      'No tienes acceso a esa bodega',
    )
  })

  it('sin bodegas asignadas, el operario ve el aviso para pedir una asignación', async () => {
    vi.mocked(warehousesApi.listWarehouses).mockResolvedValue(pageOf([]))
    const wrapper = await mountView('OPERATOR')
    expect(wrapper.find('[data-test=no-warehouses]').text()).toContain(
      'No tienes bodegas asignadas',
    )
  })
})
