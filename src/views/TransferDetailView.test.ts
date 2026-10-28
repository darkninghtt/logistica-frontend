import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import * as api from '@/api/transfers'
import * as warehousesApi from '@/api/warehouses'
import { ApiError } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import TransferDetailView from './TransferDetailView.vue'
import type { Role } from '@/types/auth'
import type { TransferDetail, TransferItem } from '@/types/transfer'

vi.mock('@/api/transfers')
vi.mock('@/api/warehouses')

const USER = 'u-actor'

function item(unitCost?: string | null): TransferItem {
  return {
    productId: 'p1',
    productSku: 'S1',
    productName: 'Tornillo',
    quantitySent: 8,
    quantityReceived: null,
    ...(unitCost === undefined ? {} : { unitCost }),
  }
}

function transfer(
  status: TransferDetail['status'] = 'DRAFT',
  overrides: Partial<TransferDetail> = {},
): TransferDetail {
  return {
    id: 't1',
    status,
    origin: { id: 'wa', code: 'A', name: 'Bodega A' },
    destination: { id: 'wb', code: 'B', name: 'Bodega B' },
    note: 'urgente',
    createdBy: USER,
    dispatchedBy: null,
    dispatchedAt: null,
    receivedBy: null,
    receivedAt: null,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    items: [item(status === 'DRAFT' ? null : '110.0000')],
    events: [
      {
        fromStatus: null,
        toStatus: 'DRAFT',
        actor: { id: USER, name: 'Jefe de A' },
        reason: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    ...overrides,
  }
}

async function mountView(role: Role = 'WAREHOUSE_MANAGER', userId = USER) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore(pinia).user = { id: userId, name: 'Prueba', email: 'u@b.co', role }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/traspasos', component: TransferDetailView },
      { path: '/traspasos/:id', component: TransferDetailView },
    ],
  })
  await router.push('/traspasos/t1')
  const wrapper = mount(TransferDetailView, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return wrapper
}

function buttonLabels(wrapper: Awaited<ReturnType<typeof mountView>>): string[] {
  return wrapper.findAll('button').map((b) => b.text())
}

/** Bodegas asignadas a quien mira el detalle (por defecto, el origen A). */
function assignedTo(...codes: string[]) {
  const all = [
    { id: 'wa', code: 'A', name: 'Bodega A' },
    { id: 'wb', code: 'B', name: 'Bodega B' },
  ]
  const data = all
    .filter((w) => codes.includes(w.code))
    .map((w) => ({ ...w, active: true, createdAt: '' }))
  vi.mocked(warehousesApi.listWarehouses).mockResolvedValue({
    data,
    page: 1,
    pageSize: 100,
    total: data.length,
  })
  vi.mocked(warehousesApi.listDestinations).mockResolvedValue(all)
}

beforeEach(() => {
  vi.resetAllMocks()
  assignedTo('A')
})

describe('TransferDetailView: estados de la vista', () => {
  it('muestra el estado de carga mientras llega el traspaso', async () => {
    vi.mocked(api.getTransfer).mockReturnValue(new Promise(() => undefined))
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('Cargando el traspaso')
  })

  it('si falla la carga muestra el error y permite reintentar', async () => {
    vi.mocked(api.getTransfer).mockRejectedValueOnce(
      new ApiError('No existe', 404, 'NOT_FOUND', null),
    )
    const wrapper = await mountView()
    expect(wrapper.find('[role=alert]').text()).toContain('No existe')

    vi.mocked(api.getTransfer).mockResolvedValue(transfer())
    await wrapper.find('[role=alert] button').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test=status]').text()).toBe('Borrador')
  })

  it('muestra bodegas, nota, productos y la línea de eventos', async () => {
    vi.mocked(api.getTransfer).mockResolvedValue(
      transfer('IN_TRANSIT', {
        events: [
          {
            fromStatus: null,
            toStatus: 'DRAFT',
            actor: { id: USER, name: 'Jefe de A' },
            reason: null,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
          {
            fromStatus: 'DRAFT',
            toStatus: 'IN_TRANSIT',
            actor: { id: USER, name: 'Jefe de A' },
            reason: null,
            createdAt: '2026-01-01T01:00:00.000Z',
          },
        ],
      }),
    )
    const wrapper = await mountView()

    expect(wrapper.find('h1').text()).toContain('A → B')
    expect(wrapper.find('[data-test=status]').text()).toBe('En tránsito')
    expect(wrapper.text()).toContain('A · Bodega A')
    expect(wrapper.text()).toContain('urgente')
    expect(wrapper.find('tbody').text()).toContain('S1 · Tornillo')
    const events = wrapper.findAll('.events li')
    expect(events).toHaveLength(2)
    expect(events[1]?.text()).toContain('En tránsito')
    expect(events[1]?.text()).toContain('antes: Borrador')
    expect(events[1]?.text()).toContain('Jefe de A')
  })

  it('muestra el costo congelado a quien lo recibe', async () => {
    vi.mocked(api.getTransfer).mockResolvedValue(transfer('IN_TRANSIT'))
    const wrapper = await mountView('WAREHOUSE_MANAGER')
    expect(wrapper.find('thead').text()).toContain('Costo unitario')
    expect(wrapper.find('tbody').text()).toContain('$110.0000')
  })

  it('al OPERATOR (sin costos en la respuesta) no le muestra la columna de costos', async () => {
    vi.mocked(api.getTransfer).mockResolvedValue(transfer('IN_TRANSIT', { items: [item()] }))
    const wrapper = await mountView('OPERATOR')
    expect(wrapper.find('thead').text()).not.toContain('Costo')
    expect(wrapper.text()).not.toContain('$')
  })
})

describe('TransferDetailView: botones según permiso y estado', () => {
  it('el jefe ve Despachar y Cancelar en un borrador', async () => {
    vi.mocked(api.getTransfer).mockResolvedValue(transfer('DRAFT'))
    const wrapper = await mountView('WAREHOUSE_MANAGER')
    expect(buttonLabels(wrapper)).toEqual(['Despachar', 'Cancelar traspaso'])
  })

  it('el OPERATOR no ve Despachar; ve Cancelar solo si creó el traspaso', async () => {
    vi.mocked(api.getTransfer).mockResolvedValue(transfer('DRAFT'))
    expect(buttonLabels(await mountView('OPERATOR', USER))).toEqual(['Cancelar traspaso'])
    expect(buttonLabels(await mountView('OPERATOR', 'otra-persona'))).toEqual([])
  })

  it('el jefe del destino no ve Despachar ni Cancelar: el origen no es suyo', async () => {
    assignedTo('B')
    vi.mocked(api.getTransfer).mockResolvedValue(transfer('DRAFT'))
    expect(buttonLabels(await mountView('WAREHOUSE_MANAGER'))).toEqual([])
  })

  it('el operario del destino no ve Cancelar aunque haya creado el traspaso', async () => {
    assignedTo('B')
    vi.mocked(api.getTransfer).mockResolvedValue(transfer('DRAFT'))
    expect(buttonLabels(await mountView('OPERATOR', USER))).toEqual([])
  })

  it('si no se pueden cargar las bodegas no ofrece acciones', async () => {
    vi.mocked(warehousesApi.listWarehouses).mockRejectedValue(
      new ApiError('Caído', 503, null, null),
    )
    vi.mocked(api.getTransfer).mockResolvedValue(transfer('DRAFT'))
    expect(buttonLabels(await mountView('WAREHOUSE_MANAGER'))).toEqual([])
  })

  it.each(['ADMIN', 'AUDITOR'] as const)('%s no ve acciones', async (role) => {
    vi.mocked(api.getTransfer).mockResolvedValue(transfer('DRAFT'))
    expect(buttonLabels(await mountView(role))).toEqual([])
  })

  it.each(['IN_TRANSIT', 'RECEIVED', 'DISCREPANCY', 'RESOLVED', 'CANCELLED'] as const)(
    'en %s no hay despachar ni cancelar',
    async (status) => {
      vi.mocked(api.getTransfer).mockResolvedValue(transfer(status))
      expect(buttonLabels(await mountView('WAREHOUSE_MANAGER'))).toEqual([])
    },
  )
})

describe('TransferDetailView: despachar', () => {
  it('despacha, muestra el nuevo estado y quita los botones', async () => {
    vi.mocked(api.getTransfer).mockResolvedValue(transfer('DRAFT'))
    vi.mocked(api.dispatchTransfer).mockResolvedValue(transfer('IN_TRANSIT'))
    const wrapper = await mountView()

    await wrapper.findAll('button')[0]?.trigger('click')
    await flushPromises()

    expect(api.dispatchTransfer).toHaveBeenCalledWith('t1')
    expect(wrapper.find('[data-test=status]').text()).toBe('En tránsito')
    expect(buttonLabels(wrapper)).toEqual([])
  })

  it('el doble clic no envía dos peticiones: el botón se deshabilita mientras carga', async () => {
    vi.mocked(api.getTransfer).mockResolvedValue(transfer('DRAFT'))
    let finish: (value: TransferDetail) => void = () => undefined
    vi.mocked(api.dispatchTransfer).mockReturnValue(new Promise((resolve) => (finish = resolve)))
    const wrapper = await mountView()
    const dispatch = wrapper.findAll('button')[0]

    await dispatch?.trigger('click')
    await dispatch?.trigger('click')

    expect(dispatch?.text()).toBe('Procesando…')
    expect(dispatch?.attributes('disabled')).toBeDefined()
    expect(api.dispatchTransfer).toHaveBeenCalledTimes(1)

    finish(transfer('IN_TRANSIT'))
    await flushPromises()
    expect(wrapper.find('[data-test=status]').text()).toBe('En tránsito')
  })

  it('ante un 409 muestra el mensaje y el estado real del traspaso', async () => {
    vi.mocked(api.getTransfer).mockResolvedValueOnce(transfer('DRAFT'))
    vi.mocked(api.dispatchTransfer).mockRejectedValue(
      new ApiError('El traspaso está en IN_TRANSIT', 409, 'INVALID_TRANSITION', 'c1'),
    )
    const wrapper = await mountView()
    vi.mocked(api.getTransfer).mockResolvedValue(transfer('IN_TRANSIT'))

    await wrapper.findAll('button')[0]?.trigger('click')
    await flushPromises()

    expect(wrapper.find('[role=alert]').text()).toContain('El traspaso está en IN_TRANSIT')
    expect(wrapper.find('[data-test=status]').text()).toBe('En tránsito')
    expect(buttonLabels(wrapper)).toEqual([])
  })

  it('con stock insuficiente muestra el error y el traspaso sigue en borrador', async () => {
    vi.mocked(api.getTransfer).mockResolvedValue(transfer('DRAFT'))
    vi.mocked(api.dispatchTransfer).mockRejectedValue(
      new ApiError(
        'No hay stock suficiente en la bodega de origen',
        409,
        'INSUFFICIENT_STOCK',
        'c1',
      ),
    )
    const wrapper = await mountView()

    await wrapper.findAll('button')[0]?.trigger('click')
    await flushPromises()

    expect(wrapper.find('[role=alert]').text()).toContain('No hay stock suficiente')
    expect(wrapper.find('[data-test=status]').text()).toBe('Borrador')
    expect(buttonLabels(wrapper)).toContain('Despachar')
  })
})

describe('TransferDetailView: cancelar', () => {
  it('pide el motivo opcional y cancela con él', async () => {
    vi.mocked(api.getTransfer).mockResolvedValue(transfer('DRAFT'))
    vi.mocked(api.cancelTransfer).mockResolvedValue(transfer('CANCELLED'))
    const wrapper = await mountView()

    await wrapper.findAll('button')[1]?.trigger('click')
    await wrapper.find('input[name=reason]').setValue('Ya no hace falta')
    await wrapper.find('form.cancel').trigger('submit')
    await flushPromises()

    expect(api.cancelTransfer).toHaveBeenCalledWith('t1', 'Ya no hace falta')
    expect(wrapper.find('[data-test=status]').text()).toBe('Cancelado')
    expect(wrapper.find('form.cancel').exists()).toBe(false)
  })

  it('sin motivo cancela sin enviarlo', async () => {
    vi.mocked(api.getTransfer).mockResolvedValue(transfer('DRAFT'))
    vi.mocked(api.cancelTransfer).mockResolvedValue(transfer('CANCELLED'))
    const wrapper = await mountView()

    await wrapper.findAll('button')[1]?.trigger('click')
    await wrapper.find('form.cancel').trigger('submit')
    await flushPromises()

    expect(api.cancelTransfer).toHaveBeenCalledWith('t1', undefined)
  })

  it('Volver cierra el formulario sin cancelar', async () => {
    vi.mocked(api.getTransfer).mockResolvedValue(transfer('DRAFT'))
    const wrapper = await mountView()

    await wrapper.findAll('button')[1]?.trigger('click')
    await wrapper
      .findAll('form.cancel button')
      .find((b) => b.text() === 'Volver')
      ?.trigger('click')

    expect(wrapper.find('form.cancel').exists()).toBe(false)
    expect(api.cancelTransfer).not.toHaveBeenCalled()
  })
})
