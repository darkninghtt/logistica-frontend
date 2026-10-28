import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import * as authApi from '@/api/auth'
import * as stockApi from '@/api/stock'
import * as transfersApi from '@/api/transfers'
import { useAuthStore } from './auth'
import { createResetOnSessionEnd } from './resetOnSessionEnd'
import { useStockStore } from './stock'
import { useTransfersStore } from './transfers'
import type { TransferDetail } from '@/types/transfer'

vi.mock('@/api/auth')
vi.mock('@/api/stock')
vi.mock('@/api/transfers')

const withCosts: TransferDetail = {
  id: 't1',
  status: 'IN_TRANSIT',
  origin: { id: 'wa', code: 'A', name: 'Bodega A' },
  destination: { id: 'wb', code: 'B', name: 'Bodega B' },
  note: null,
  createdBy: 'u1',
  dispatchedBy: 'u1',
  dispatchedAt: '2026-01-01T00:00:00.000Z',
  receivedBy: null,
  receivedAt: null,
  resolvedBy: null,
  resolvedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  items: [
    {
      productId: 'p1',
      productSku: 'S1',
      productName: 'Tornillo',
      quantitySent: 8,
      quantityReceived: null,
      unitCost: '110.0000',
    },
  ],
  events: [],
}

beforeEach(() => {
  const pinia = createPinia()
  pinia.use(createResetOnSessionEnd())
  // Pinia solo aplica los plugins cuando está instalada en una app (como en main.ts)
  createApp({}).use(pinia)
  setActivePinia(pinia)
  vi.resetAllMocks()
})

async function loadAsManager() {
  vi.mocked(transfersApi.getTransfer).mockResolvedValue(withCosts)
  const transfers = useTransfersStore()
  await transfers.fetchDetail('t1')
  useStockStore().warehouseId = 'wa'
  return transfers
}

describe('resetOnSessionEnd', () => {
  it('al cerrar sesión vacía los datos de los demás stores (sin costos de la persona anterior)', async () => {
    const transfers = await loadAsManager()
    expect(transfers.details['t1']?.items[0]?.unitCost).toBe('110.0000')

    await useAuthStore().logout()

    expect(transfers.details).toEqual({})
    expect(transfers.detailStatus).toBe('idle')
    expect(useStockStore().warehouseId).toBe('')
  })

  it('al perder la sesión (clearSession) también los vacía', async () => {
    const transfers = await loadAsManager()

    useAuthStore().clearSession()

    expect(transfers.details).toEqual({})
  })

  it('después de vaciar, el detalle vuelve a pedirse al servidor aunque la caché siguiera vigente', async () => {
    const transfers = await loadAsManager()
    useAuthStore().clearSession()

    await transfers.fetchDetail('t1')

    expect(transfersApi.getTransfer).toHaveBeenCalledTimes(2)
  })

  it('no vacía nada mientras la sesión sigue abierta', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      accessToken: 't',
      user: { id: 'u1', name: 'Jefe', email: 'j@b.co', role: 'WAREHOUSE_MANAGER' },
    })
    const transfers = await loadAsManager()

    await useAuthStore().login({ email: 'j@b.co', password: 'x' })

    expect(transfers.details['t1']).toBeDefined()
  })

  it('el store de sesión conserva su propio estado al cerrar la sesión', async () => {
    const auth = useAuthStore()
    auth.user = { id: 'u1', name: 'Jefe', email: 'j@b.co', role: 'WAREHOUSE_MANAGER' }

    await auth.logout()

    expect(auth.user).toBeNull()
    expect(auth.sessionChecked).toBe(true)
  })

  it('una respuesta que llega después de cerrar sesión no vuelve a llenar el detalle', async () => {
    let arrive: (value: TransferDetail) => void = () => undefined
    vi.mocked(transfersApi.getTransfer).mockReturnValue(
      new Promise((resolve) => (arrive = resolve)),
    )
    const transfers = useTransfersStore()

    const pending = transfers.fetchDetail('t1')
    await useAuthStore().logout()
    arrive(withCosts)
    await pending

    expect(transfers.details).toEqual({})
    expect(transfers.detailStatus).toBe('idle')
  })

  it('una acción que termina después de cerrar sesión no guarda su resultado', async () => {
    let arrive: (value: TransferDetail) => void = () => undefined
    vi.mocked(transfersApi.dispatchTransfer).mockReturnValue(
      new Promise((resolve) => (arrive = resolve)),
    )
    const transfers = useTransfersStore()

    const pending = transfers.dispatch('t1')
    useAuthStore().clearSession()
    arrive(withCosts)

    expect(await pending).toBe(false)
    expect(transfers.details).toEqual({})
  })

  it('las existencias con costos que llegan después de cerrar sesión se descartan', async () => {
    let arrive: (value: Awaited<ReturnType<typeof stockApi.listStockLevels>>) => void = () =>
      undefined
    vi.mocked(stockApi.listStockLevels).mockReturnValue(
      new Promise((resolve) => (arrive = resolve)),
    )
    vi.mocked(stockApi.listStockMovements).mockResolvedValue({
      data: [],
      page: 1,
      pageSize: 10,
      total: 0,
    })
    const stock = useStockStore()

    const pending = stock.selectWarehouse('wa')
    useAuthStore().clearSession()
    arrive({
      data: [
        {
          productId: 'p1',
          warehouseId: 'wa',
          quantity: 20,
          avgCost: '110.0000',
          totalValue: '2200.0000',
          productSku: 'S1',
          productName: 'Tornillo',
          productUnit: 'un',
        },
      ],
      page: 1,
      pageSize: 10,
      total: 1,
    })
    await pending

    expect(stock.levels).toEqual([])
    expect(stock.warehouseId).toBe('')
  })
})
