export interface Warehouse {
  id: string
  code: string
  name: string
  active: boolean
  createdAt: string
}

/** Cuerpo de POST y PUT /api/warehouses. */
export interface WarehouseInput {
  code: string
  name: string
  active: boolean
}
