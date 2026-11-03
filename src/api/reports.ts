import type {
  ExportFormat,
  InTransitReport,
  KardexPage,
  ShrinkageFilters,
  ShrinkageReport,
} from '@/types/report'
import { http } from './http'

/** Kardex de un producto en una bodega, en orden cronológico. Sin `cursor`, la primera página. */
export async function getKardex(
  warehouseId: string,
  productId: string,
  limit: number,
  cursor?: string,
): Promise<KardexPage> {
  const res = await http.get<KardexPage>('/reports/kardex', {
    params: { warehouseId, productId, limit, cursor },
  })
  return res.data
}

/** Los filtros vacíos se envían como undefined para que axios los omita. */
function shrinkageParams(filters: ShrinkageFilters): Record<string, string | undefined> {
  return {
    warehouseId: filters.warehouseId || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
  }
}

export async function getShrinkageReport(filters: ShrinkageFilters): Promise<ShrinkageReport> {
  const res = await http.get<ShrinkageReport>('/reports/shrinkage', {
    params: shrinkageParams(filters),
  })
  return res.data
}

/** Sin bodega, los traspasos de todas las bodegas visibles. */
export async function getInTransitReport(warehouseId?: string): Promise<InTransitReport> {
  const res = await http.get<InTransitReport>('/reports/in-transit', {
    params: { warehouseId: warehouseId || undefined },
  })
  return res.data
}

export interface DownloadedFile {
  blob: Blob
  filename: string
}

/** Nombre que propone el servidor en `Content-Disposition` (con o sin comillas). */
export function filenameFrom(disposition: unknown, fallback: string): string {
  if (typeof disposition !== 'string') return fallback
  const match = /filename="?([^";]+)"?/.exec(disposition)
  return match?.[1] ?? fallback
}

/**
 * Descarga por el cliente axios (no con un enlace normal): así viaja el access token, que vive solo
 * en memoria y no en una cookie.
 */
async function download(
  path: string,
  params: Record<string, string | undefined>,
  fallback: string,
): Promise<DownloadedFile> {
  const res = await http.get<Blob>(path, { params, responseType: 'blob' })
  return { blob: res.data, filename: filenameFrom(res.headers['content-disposition'], fallback) }
}

export function downloadKardex(
  warehouseId: string,
  productId: string,
  format: ExportFormat,
): Promise<DownloadedFile> {
  return download('/reports/kardex/export', { warehouseId, productId, format }, `kardex.${format}`)
}

export function downloadShrinkage(
  filters: ShrinkageFilters,
  format: ExportFormat,
): Promise<DownloadedFile> {
  return download(
    '/reports/shrinkage/export',
    { ...shrinkageParams(filters), format },
    `mermas.${format}`,
  )
}
