import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import * as api from '@/api/reports'
import { ApiError } from '@/api/http'
import { dashboardSummary, piniaSignedInAs } from '@/testing'
import type { ChartSeries } from '@/dashboard'
import type { Role } from '@/types/auth'
import HomeView from './HomeView.vue'

vi.mock('@/api/reports')

// No se prueba el dibujo de Chart.js (jsdom no tiene canvas): solo los datos que recibe
vi.mock('@/components/DashboardCharts.vue', () => ({
  // Que Vue lo trate como módulo ES y tome `default` al cargarlo de forma diferida
  __esModule: true,
  default: defineComponent({
    props: {
      inventory: { type: Object, required: true },
      transfers: { type: Object, required: true },
    },
    setup(props) {
      return () => h('div', { 'data-test': 'charts', 'data-props': JSON.stringify(props) })
    },
  }),
}))

async function mountAs(role: Role) {
  const wrapper = mount(HomeView, { global: { plugins: [piniaSignedInAs(role)] } })
  await flushPromises()
  // El componente de gráficos se carga de forma diferida
  await vi.dynamicImportSettled()
  await flushPromises()
  return wrapper
}

function chartProps(wrapper: Awaited<ReturnType<typeof mountAs>>): {
  inventory: ChartSeries
  transfers: ChartSeries
} {
  return JSON.parse(wrapper.find('[data-test=charts]').attributes('data-props') ?? '{}')
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('HomeView (dashboard)', () => {
  it.each(['ADMIN', 'AUDITOR', 'WAREHOUSE_MANAGER'] as const)(
    '%s ve el dashboard con los totales',
    async (role) => {
      vi.mocked(api.getSummary).mockResolvedValue(dashboardSummary())
      const wrapper = await mountAs(role)

      expect(wrapper.find('[data-test=card-transit]').text()).toMatch(/208,24/)
      expect(wrapper.find('[data-test=card-transit]').text()).toContain('1 traspasos en camino')
      expect(wrapper.find('[data-test=card-shrinkage]').text()).toMatch(/492,35/)
      expect(wrapper.find('[data-test=card-shrinkage]').text()).toContain('5 unidades')
      expect(wrapper.find('[data-test=card-transfers]').text()).toContain('8')
      expect(wrapper.find('[data-test=inventory-table]').text()).toMatch(/A · Bodega A.*1\.249,41/)
    },
  )

  it('pasa a los gráficos el inventario por bodega y los traspasos por estado', async () => {
    vi.mocked(api.getSummary).mockResolvedValue(dashboardSummary())
    const wrapper = await mountAs('ADMIN')

    expect(chartProps(wrapper)).toEqual({
      inventory: { labels: ['A · Bodega A', 'B · Bodega B'], values: [1249.4112, 450] },
      transfers: {
        labels: [
          'Borrador',
          'En tránsito',
          'Recibido',
          'Con discrepancia',
          'Resuelto',
          'Cancelado',
        ],
        values: [2, 1, 3, 1, 1, 0],
      },
    })
  })

  it('el OPERATOR ve el inicio de siempre y no pide el resumen', async () => {
    const wrapper = await mountAs('OPERATOR')
    expect(wrapper.text()).toContain('Traspasos inter-bodegas')
    expect(api.getSummary).not.toHaveBeenCalled()
  })

  it('muestra la carga mientras espera', () => {
    vi.mocked(api.getSummary).mockReturnValue(new Promise(() => undefined))
    const wrapper = mount(HomeView, { global: { plugins: [piniaSignedInAs('ADMIN')] } })
    expect(wrapper.text()).toContain('Cargando el resumen')
  })

  it('muestra el error y permite reintentar', async () => {
    vi.mocked(api.getSummary)
      .mockRejectedValueOnce(new ApiError('Caído', 503, null, null))
      .mockResolvedValueOnce(dashboardSummary())
    const wrapper = await mountAs('ADMIN')
    expect(wrapper.text()).toContain('No se pudo cargar el resumen: Caído')

    await wrapper.find('[role=alert] button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test=card-transit]').exists()).toBe(true)
  })

  it('sin bodegas activas muestra el vacío en lugar de los gráficos', async () => {
    vi.mocked(api.getSummary).mockResolvedValue({
      ...dashboardSummary(),
      inventoryValueByWarehouse: [],
    })
    const wrapper = await mountAs('WAREHOUSE_MANAGER')
    expect(wrapper.find('[data-test=no-warehouses]').exists()).toBe(true)
    expect(wrapper.find('[data-test=charts]').exists()).toBe(false)
  })
})
