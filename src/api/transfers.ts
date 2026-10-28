import type { Page } from '@/types/api'
import type {
  TransferDetail,
  TransferFilters,
  TransferInput,
  TransferReceiveInput,
  TransferSummary,
} from '@/types/transfer'
import { http } from './http'

export async function listTransfers(
  filters: TransferFilters,
  page: number,
  pageSize: number,
): Promise<Page<TransferSummary>> {
  const res = await http.get<Page<TransferSummary>>('/transfers', {
    // Los filtros vacíos no se envían
    params: {
      page,
      pageSize,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
    },
  })
  return res.data
}

export async function getTransfer(id: string): Promise<TransferDetail> {
  const res = await http.get<TransferDetail>(`/transfers/${id}`)
  return res.data
}

export async function createTransfer(input: TransferInput): Promise<TransferDetail> {
  const res = await http.post<TransferDetail>('/transfers', input)
  return res.data
}

export async function cancelTransfer(id: string, reason?: string): Promise<TransferDetail> {
  const res = await http.post<TransferDetail>(`/transfers/${id}/cancel`, reason ? { reason } : {})
  return res.data
}

export async function dispatchTransfer(id: string): Promise<TransferDetail> {
  const res = await http.post<TransferDetail>(`/transfers/${id}/dispatch`)
  return res.data
}

export async function receiveTransfer(
  id: string,
  input: TransferReceiveInput,
): Promise<TransferDetail> {
  const res = await http.post<TransferDetail>(`/transfers/${id}/receive`, input)
  return res.data
}

export async function resolveTransfer(id: string, reason: string): Promise<TransferDetail> {
  const res = await http.post<TransferDetail>(`/transfers/${id}/resolve`, { reason })
  return res.data
}
