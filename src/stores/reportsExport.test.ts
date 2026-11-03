import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import * as reportsApi from '@/api/reports'
import { filenameFrom } from '@/api/reports'
import { ApiError } from '@/api/http'
import { saveFile } from '@/composables/useDownload'
import { useReportsStore } from './reports'
import type { ShrinkageReport } from '@/types/report'

vi.mock('@/api/reports', async (importOriginal) => {
  // filenameFrom es una función pura: se usa la real; el resto de la API se simula
  const real = await importOriginal<typeof import('@/api/reports')>()
  return {
    filenameFrom: real.filenameFrom,
    getKardex: vi.fn(),
    getShrinkageReport: vi.fn(),
    getInTransitReport: vi.fn(),
    downloadKardex: vi.fn(),
    downloadShrinkage: vi.fn(),
  }
})
vi.mock('@/composables/useDownload', () => ({ saveFile: vi.fn() }))

const FILTERS = { warehouseId: '', from: '2026-11-01', to: '2026-11-03' }
const REPORT: ShrinkageReport = {
  data: [
    {
      warehouseId: 'w-1',
      warehouseCode: 'A',
      warehouseName: 'Bodega A',
      productId: 'p-1',
      productSku: 'SKU-1',
      productName: 'Tornillo',
      type: 'SHRINKAGE',
      reason: 'DAMAGE',
      quantity: 3,
      value: '312.3528',
    },
  ],
  totals: { quantity: 3, value: '312.3528' },
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

describe('filenameFrom', () => {
  it('lee el nombre con o sin comillas y usa el de respaldo si no hay cabecera', () => {
    expect(filenameFrom('attachment; filename=kardex-A-SKU-1.csv', 'x.csv')).toBe(
      'kardex-A-SKU-1.csv',
    )
    expect(filenameFrom('attachment; filename="mermas.pdf"', 'x.pdf')).toBe('mermas.pdf')
    expect(filenameFrom(undefined, 'kardex.csv')).toBe('kardex.csv')
  })
})

describe('store reports: mermas, en tránsito y exportación', () => {
  it('carga el reporte de mermas con los filtros', async () => {
    vi.mocked(reportsApi.getShrinkageReport).mockResolvedValue(REPORT)
    const store = useReportsStore()

    await store.loadShrinkage(FILTERS)

    expect(reportsApi.getShrinkageReport).toHaveBeenCalledWith(FILTERS)
    expect(store.shrinkageStatus).toBe('success')
    expect(store.shrinkage?.totals.value).toBe('312.3528')
  })

  it('un error del reporte en tránsito queda en su propio estado', async () => {
    vi.mocked(reportsApi.getInTransitReport).mockRejectedValue(
      new ApiError('No tienes acceso a esa bodega', 403, 'FORBIDDEN', 'x'),
    )
    const store = useReportsStore()

    await store.loadInTransit('w-9')

    expect(store.inTransitStatus).toBe('error')
    expect(store.inTransitError).toBe('No tienes acceso a esa bodega')
    expect(store.shrinkageStatus).toBe('idle')
  })

  it('descarta una respuesta de mermas que llega después de otra consulta', async () => {
    let resolveFirst: (value: ShrinkageReport) => void = () => undefined
    vi.mocked(reportsApi.getShrinkageReport)
      .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce({ data: [], totals: { quantity: 0, value: '0.0000' } })
    const store = useReportsStore()

    const first = store.loadShrinkage(FILTERS)
    await store.loadShrinkage({ ...FILTERS, warehouseId: 'w-2' })
    resolveFirst(REPORT)
    await first

    expect(store.shrinkage?.data).toEqual([])
  })

  it('exporta el kardex de la selección actual y entrega el archivo al navegador', async () => {
    const blob = new Blob(['a,b'])
    vi.mocked(reportsApi.getKardex).mockResolvedValue({
      data: [],
      nextCursor: null,
      warehouse: { id: 'w-1', code: 'A', name: 'Bodega A' },
      product: { id: 'p-1', sku: 'SKU-1', name: 'Tornillo', unit: 'un' },
    })
    vi.mocked(reportsApi.downloadKardex).mockResolvedValue({ blob, filename: 'kardex-A.csv' })
    const store = useReportsStore()
    await store.loadKardex('w-1', 'p-1')

    await store.exportKardex('csv')

    expect(reportsApi.downloadKardex).toHaveBeenCalledWith('w-1', 'p-1', 'csv')
    expect(saveFile).toHaveBeenCalledWith(blob, 'kardex-A.csv')
    expect(store.exportStatus).toBe('success')
  })

  it('si la exportación falla, avisa y no entrega ningún archivo', async () => {
    vi.mocked(reportsApi.downloadShrinkage).mockRejectedValue(
      new ApiError('No tienes permiso para realizar esta acción', 403, 'FORBIDDEN', 'x'),
    )
    const store = useReportsStore()

    await store.exportShrinkage(FILTERS, 'pdf')

    expect(reportsApi.downloadShrinkage).toHaveBeenCalledWith(FILTERS, 'pdf')
    expect(store.exportStatus).toBe('error')
    expect(store.exportError).toBe('No tienes permiso para realizar esta acción')
    expect(saveFile).not.toHaveBeenCalled()
  })
})

describe('saveFile', () => {
  afterEach(() => vi.restoreAllMocks())

  it('crea un enlace temporal con el nombre del archivo, lo pulsa y libera la URL', async () => {
    const real = await vi.importActual<typeof import('@/composables/useDownload')>(
      '@/composables/useDownload',
    )
    const createObjectURL = vi.fn(() => 'blob:fake')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    real.saveFile(new Blob(['x']), 'mermas.csv')

    expect(click).toHaveBeenCalledTimes(1)
    const link = click.mock.contexts[0]
    expect(link instanceof HTMLAnchorElement && link.download).toBe('mermas.csv')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake')
    expect(document.querySelector('a[download]')).toBeNull()
    vi.unstubAllGlobals()
  })
})
