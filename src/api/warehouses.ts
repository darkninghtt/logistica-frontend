import type { Page } from '@/types/api'
import type { Warehouse, WarehouseInput } from '@/types/warehouse'
import { http } from './http'

export async function listWarehouses(page: number, pageSize: number): Promise<Page<Warehouse>> {
  const res = await http.get<Page<Warehouse>>('/warehouses', { params: { page, pageSize } })
  return res.data
}

export async function createWarehouse(input: WarehouseInput): Promise<Warehouse> {
  const res = await http.post<Warehouse>('/warehouses', input)
  return res.data
}

export async function updateWarehouse(id: string, input: WarehouseInput): Promise<Warehouse> {
  const res = await http.put<Warehouse>(`/warehouses/${id}`, input)
  return res.data
}
