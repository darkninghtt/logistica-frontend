import type { ApiSchema } from './contract'

export type Warehouse = ApiSchema<'Warehouse'>

/** Cuerpo de POST y PUT /api/warehouses. */
export type WarehouseInput = ApiSchema<'WarehouseInput'>

/** GET /api/warehouses. */
export type WarehousePage = ApiSchema<'WarehousePage'>

/** GET /api/warehouses/destinations: todas las bodegas activas. */
export type WarehouseDestinationList = ApiSchema<'WarehouseDestinationList'>
