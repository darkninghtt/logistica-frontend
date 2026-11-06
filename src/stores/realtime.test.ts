import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia } from 'pinia'
import { piniaSignedInAs } from '@/testing'
import { useDashboardStore } from './dashboard'
import { NOTICE_TTL_MS, useRealtimeStore } from './realtime'
import { useStockStore } from './stock'
import { useTransfersStore } from './transfers'
import type { Role } from '@/types/auth'
import type { RealtimeEvent, RealtimeScreen } from '@/types/realtime'
import type { TransferDetail, TransferStatus } from '@/types/transfer'

vi.mock('@/api/transfers')
vi.mock('@/api/warehouses')
vi.mock('@/api/products')
vi.mock('@/api/stock')
vi.mock('@/api/reports')

const ON_LIST: RealtimeScreen = { name: 'transfers', transferId: null }
const ON_HOME: RealtimeScreen = { name: null, transferId: null }

function transferEvent(status: TransferStatus, destination = 'wb'): RealtimeEvent {
  return {
    type: 'transfer.updated',
    payload: {
      transferId: 't1',
      status,
      originWarehouseId: 'wa',
      destinationWarehouseId: destination,
    },
  }
}

/** Sesión con ese rol, la bodega B asignada y los stores de traspasos y stock espiados. */
function setup(role: Role) {
  setActivePinia(piniaSignedInAs(role))
  const transfers = useTransfersStore()
  const stock = useStockStore()
  const refreshTransfers = vi.spyOn(transfers, 'refreshAfterEvent').mockResolvedValue()
  const refreshStock = vi.spyOn(stock, 'refreshAfterEvent').mockResolvedValue()
  vi.spyOn(transfers, 'loadWarehouses').mockImplementation(async () => {
    transfers.origins = [{ id: 'wb', code: 'B', name: 'Bodega B' }]
  })
  return { realtime: useRealtimeStore(), transfers, refreshTransfers, refreshStock }
}

/** Deja cargado el detalle del traspaso t1 con ese estado (lo que la pantalla está mostrando). */
function withDetail(transfers: ReturnType<typeof useTransfersStore>, status: TransferStatus) {
  const warehouse = { id: 'wa', code: 'A', name: 'Bodega A' }
  const loaded: TransferDetail = {
    id: 't1',
    status,
    origin: warehouse,
    destination: { id: 'wb', code: 'B', name: 'Bodega B' },
    note: null,
    createdBy: 'u1',
    dispatchedBy: null,
    dispatchedAt: null,
    receivedBy: null,
    receivedAt: null,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    items: [],
    events: [],
  }
  transfers.details = { t1: loaded }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('store realtime: qué se recarga', () => {
  it('stock.changed recarga el stock solo si está en pantalla', async () => {
    const { realtime, refreshStock } = setup('OPERATOR')
    const event: RealtimeEvent = {
      type: 'stock.changed',
      payload: { warehouseId: 'wa', productIds: ['p1'] },
    }

    await realtime.handleEvent(event, { name: 'stock', transferId: null })
    await realtime.handleEvent(event, ON_LIST)

    expect(refreshStock).toHaveBeenNthCalledWith(1, 'wa', true)
    expect(refreshStock).toHaveBeenNthCalledWith(2, 'wa', false)
  })

  it('transfer.updated recarga el listado o el detalle de ese traspaso si están en pantalla', async () => {
    const { realtime, refreshTransfers } = setup('AUDITOR')

    await realtime.handleEvent(transferEvent('DRAFT'), ON_LIST)
    await realtime.handleEvent(transferEvent('DRAFT'), {
      name: 'transfer-detail',
      transferId: 't1',
    })
    await realtime.handleEvent(transferEvent('DRAFT'), {
      name: 'transfer-detail',
      transferId: 't9',
    })

    expect(refreshTransfers).toHaveBeenNthCalledWith(1, 't1', { list: true, detail: false })
    expect(refreshTransfers).toHaveBeenNthCalledWith(2, 't1', { list: false, detail: true })
    expect(refreshTransfers).toHaveBeenNthCalledWith(3, 't1', { list: false, detail: false })
  })

  it('resync recarga lo que está en pantalla tras una reconexión', async () => {
    const { realtime, refreshTransfers, refreshStock } = setup('AUDITOR')
    useStockStore().warehouseId = 'wa'

    await realtime.resync({ name: 'transfer-detail', transferId: 't1' })

    expect(refreshTransfers).toHaveBeenCalledWith('t1', { list: false, detail: true })
    expect(refreshStock).toHaveBeenCalledWith('wa', false)
  })
})

describe('store realtime: avisos', () => {
  it('avisa cuando va en camino un traspaso hacia una bodega asignada', async () => {
    const { realtime } = setup('OPERATOR')

    await realtime.handleEvent(transferEvent('IN_TRANSIT'), ON_HOME)

    expect(realtime.notices).toEqual([
      { id: 1, text: 'Va en camino un traspaso hacia Bodega B.', to: '/traspasos/t1' },
    ])
  })

  it('no avisa si el destino es otra bodega, si no está en tránsito o si el rol no recibe', async () => {
    const { realtime } = setup('OPERATOR')
    await realtime.handleEvent(transferEvent('IN_TRANSIT', 'wz'), ON_HOME)
    await realtime.handleEvent(transferEvent('RECEIVED'), ON_HOME)
    expect(realtime.notices).toEqual([])

    const admin = setup('ADMIN')
    await admin.realtime.handleEvent(transferEvent('IN_TRANSIT'), ON_HOME)
    expect(admin.realtime.notices).toEqual([])
  })

  it('avisa si cambia el estado del traspaso que se está viendo', async () => {
    const { realtime, transfers } = setup('WAREHOUSE_MANAGER')
    withDetail(transfers, 'IN_TRANSIT')

    await realtime.handleEvent(transferEvent('DISCREPANCY'), {
      name: 'transfer-detail',
      transferId: 't1',
    })

    expect(realtime.notices.map((n) => n.text)).toEqual([
      'Este traspaso cambió a «Con discrepancia».',
    ])
  })

  it('no avisa si el estado que se ve ya es ese o si la acción la hizo esta misma pestaña', async () => {
    const { realtime, transfers } = setup('WAREHOUSE_MANAGER')
    const viewing: RealtimeScreen = { name: 'transfer-detail', transferId: 't1' }
    withDetail(transfers, 'IN_TRANSIT')
    await realtime.handleEvent(transferEvent('IN_TRANSIT'), viewing)

    transfers.acting = true
    await realtime.handleEvent(transferEvent('RECEIVED'), viewing)
    await realtime.handleEvent(transferEvent('IN_TRANSIT'), ON_HOME)

    expect(realtime.notices).toEqual([])
  })

  it('los avisos se cierran solos, con la x, y como mucho se ven tres', () => {
    const { realtime } = setup('OPERATOR')
    for (const text of ['uno', 'dos', 'tres', 'cuatro']) realtime.notify(text)
    expect(realtime.notices.map((n) => n.text)).toEqual(['dos', 'tres', 'cuatro'])

    realtime.dismiss(realtime.notices[0]?.id ?? 0)
    expect(realtime.notices.map((n) => n.text)).toEqual(['tres', 'cuatro'])

    vi.advanceTimersByTime(NOTICE_TTL_MS)
    expect(realtime.notices).toEqual([])
  })
})

describe('store realtime: dashboard', () => {
  const ON_DASHBOARD: RealtimeScreen = { name: 'home', transferId: null }
  const stockEvent: RealtimeEvent = {
    type: 'stock.changed',
    payload: { warehouseId: 'wa', productIds: ['p1'] },
  }

  it('cualquier evento recarga el dashboard si está en pantalla y el rol lo ve', async () => {
    const { realtime } = setup('ADMIN')
    const refresh = vi.spyOn(useDashboardStore(), 'refreshAfterEvent').mockResolvedValue()

    await realtime.handleEvent(stockEvent, ON_DASHBOARD)
    await realtime.handleEvent(transferEvent('IN_TRANSIT'), ON_DASHBOARD)
    await realtime.handleEvent(stockEvent, ON_LIST)

    expect(refresh.mock.calls.map(([onScreen]) => onScreen)).toEqual([true, true, false])
  })

  it('al OPERATOR (sin dashboard) nunca se le pide el resumen', async () => {
    const { realtime } = setup('OPERATOR')
    const refresh = vi.spyOn(useDashboardStore(), 'refreshAfterEvent').mockResolvedValue()

    await realtime.handleEvent(stockEvent, ON_DASHBOARD)

    expect(refresh).toHaveBeenCalledWith(false)
  })
})
