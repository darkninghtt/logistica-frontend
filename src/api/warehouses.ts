import type { WarehouseRef } from '@/types/transfer'
import type {
  Warehouse,
  WarehouseDestinationList,
  WarehouseInput,
  WarehousePage,
} from '@/types/warehouse'
import { http } from './http'

export async function listWarehouses(page: number, pageSize: number): Promise<WarehousePage> {
  const res = await http.get<WarehousePage>('/warehouses', { params: { page, pageSize } })
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

/** Todas las bodegas activas (id, código y nombre): las que se pueden elegir como destino de un traspaso. */
export async function listDestinations(): Promise<WarehouseRef[]> {
  const res = await http.get<WarehouseDestinationList>('/warehouses/destinations')
  return res.data.data
}
