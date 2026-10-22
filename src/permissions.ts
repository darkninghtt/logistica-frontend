import type { Role } from '@/types/auth'

/**
 * Qué puede hacer cada rol en la interfaz. Es solo comodidad (ocultar lo que daría 403): la
 * seguridad real la aplica el backend en cada endpoint (ver la matriz de roles del plan).
 */
export type Permission =
  /** Crear y editar bodegas y productos. */
  | 'catalog:write'
  /** Registrar entradas de stock. */
  | 'stock:entry'

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: ['catalog:write', 'stock:entry'],
  WAREHOUSE_MANAGER: ['stock:entry'],
  OPERATOR: [],
  AUDITOR: [],
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador',
  WAREHOUSE_MANAGER: 'Jefe de bodega',
  OPERATOR: 'Operario',
  AUDITOR: 'Auditor',
}

export function roleCan(role: Role | null, permission: Permission): boolean {
  return role !== null && ROLE_PERMISSIONS[role].includes(permission)
}
