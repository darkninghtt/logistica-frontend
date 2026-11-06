import type { Role } from './auth'
import type { ApiSchema } from './contract'

/** Usuario tal como lo ve el ADMIN (GET /api/users): sin contraseña y con sus bodegas asignadas. */
export type ManagedUser = ApiSchema<'ManagedUser'>

/** Cuerpo de POST /api/users. La contraseña inicial es obligatoria (mínimo 12 caracteres). */
export type UserCreateInput = ApiSchema<'UserCreateInput'>

/** Cuerpo de PUT /api/users/:id. La contraseña solo cambia si se envía. */
export type UserUpdateInput = ApiSchema<'UserUpdateInput'>

/** Respuesta de PUT /api/users/:id/warehouses. */
export type UserWarehouses = ApiSchema<'UserWarehouses'>

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

/** GET /api/users. */
export type ManagedUserPage = ApiSchema<'ManagedUserPage'>
