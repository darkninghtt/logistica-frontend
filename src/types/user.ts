import type { Role } from './auth'

/** Usuario tal como lo ve el ADMIN (GET /api/users): sin contraseña y con sus bodegas asignadas. */
export interface ManagedUser {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
  warehouseIds: string[]
  createdAt: string
}

/** Cuerpo de POST /api/users. La contraseña inicial es obligatoria (mínimo 12 caracteres). */
export interface UserCreateInput {
  email: string
  name: string
  role: Role
  password: string
  active: boolean
}

/** Cuerpo de PUT /api/users/:id. La contraseña solo cambia si se envía. */
export interface UserUpdateInput {
  email: string
  name: string
  role: Role
  password?: string
  active: boolean
}

/** Respuesta de PUT /api/users/:id/warehouses. */
export interface UserWarehouses {
  userId: string
  warehouseIds: string[]
}

/** Lo que entrega el formulario: los datos del usuario y las bodegas elegidas. */
export interface UserFormValue {
  email: string
  name: string
  role: Role
  /** Vacía al editar = no se cambia. */
  password: string
  active: boolean
  warehouseIds: string[]
}
