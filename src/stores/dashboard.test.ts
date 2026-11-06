import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import * as api from '@/api/reports'
import { ApiError } from '@/api/http'
import { CACHE_TTL_MS } from '@/composables/useTtlCache'
import { dashboardSummary } from '@/testing'
import { useDashboardStore } from './dashboard'

vi.mock('@/api/reports')

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  vi.useRealTimers()
})

describe('store dashboard', () => {
  it('carga el resumen pasando por loading', async () => {
    vi.mocked(api.getSummary).mockResolvedValue(dashboardSummary())
    const store = useDashboardStore()
    const loading = store.fetchSummary()
    expect(store.status).toBe('loading')
    await loading

    expect(store.status).toBe('success')
    expect(store.summary?.inTransitValue).toBe('208.2352')
  })

  it('si falla queda en error con el mensaje (403 del OPERATOR, por ejemplo)', async () => {
    vi.mocked(api.getSummary).mockRejectedValue(
      new ApiError('No tienes permiso para realizar esta acción', 403, 'FORBIDDEN', null),
    )
    const store = useDashboardStore()
    await store.fetchSummary()
    expect(store.status).toBe('error')
    expect(store.error).toBe('No tienes permiso para realizar esta acción')
  })

  it('usa la caché mientras está vigente', async () => {
    vi.useFakeTimers()
    vi.mocked(api.getSummary).mockResolvedValue(dashboardSummary())
    const store = useDashboardStore()
    await store.fetchSummary()
    await store.fetchSummary()
    expect(api.getSummary).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(CACHE_TTL_MS)
    await store.fetchSummary()
    expect(api.getSummary).toHaveBeenCalledTimes(2)
  })

  it('un aviso en vivo con el dashboard en pantalla lo recarga sin pasar por "Cargando"', async () => {
    vi.mocked(api.getSummary).mockResolvedValue(dashboardSummary())
    const store = useDashboardStore()
    await store.fetchSummary()
    vi.mocked(api.getSummary).mockResolvedValue({ ...dashboardSummary(), inTransitValue: '0.0000' })

    const refreshing = store.refreshAfterEvent(true)
    expect(store.status).toBe('success')
    await refreshing

    expect(store.summary?.inTransitValue).toBe('0.0000')
  })

  it('fuera de pantalla solo invalida: la próxima carga va al servidor', async () => {
    vi.mocked(api.getSummary).mockResolvedValue(dashboardSummary())
    const store = useDashboardStore()
    await store.fetchSummary()

    await store.refreshAfterEvent(false)
    expect(api.getSummary).toHaveBeenCalledTimes(1)
    await store.fetchSummary()
    expect(api.getSummary).toHaveBeenCalledTimes(2)
  })

  it('si la recarga en vivo falla se sigue viendo el resumen que había', async () => {
    vi.mocked(api.getSummary).mockResolvedValue(dashboardSummary())
    const store = useDashboardStore()
    await store.fetchSummary()
    vi.mocked(api.getSummary).mockRejectedValue(new ApiError('Caído', 503, null, null))

    await store.refreshAfterEvent(true)

    expect(store.status).toBe('success')
    expect(store.summary).not.toBeNull()
    expect(store.error).toBeNull()
  })
})
