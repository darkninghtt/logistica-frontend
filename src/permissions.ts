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
  /** Registrar mermas de bodega (en las bodegas asignadas). */
  | 'stock:shrinkage'
  /** Crear borradores de traspaso (desde las bodegas asignadas) y cancelar los propios. */
  | 'transfer:create'
  /** Despachar traspasos de las bodegas asignadas como origen. */
  | 'transfer:dispatch'
  /** Registrar la recepción de traspasos cuyo destino es una bodega asignada. */
  | 'transfer:receive'
  /**
   * Resolver discrepancias: el ADMIN cualquiera; el jefe, si el origen o el destino es suyo. Quien
   * recibió nunca resuelve (separación de funciones), y eso se comprueba aparte, no por rol.
   */
  | 'transfer:resolve'

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: ['catalog:write', 'stock:entry', 'transfer:resolve'],
  WAREHOUSE_MANAGER: [
    'stock:entry',
    'stock:shrinkage',
    'transfer:create',
    'transfer:dispatch',
    'transfer:receive',
    'transfer:resolve',
  ],
  OPERATOR: ['stock:shrinkage', 'transfer:create', 'transfer:receive'],
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
