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
  /** Ver kardex y reportes (datos de costo): ADMIN y AUDITOR todas las bodegas; el jefe, las suyas. */
  | 'reports:view'
  /** Crear y editar usuarios, activarlos o desactivarlos y asignarles bodegas (solo ADMIN). */
  | 'users:manage'

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: ['catalog:write', 'stock:entry', 'transfer:resolve', 'reports:view', 'users:manage'],
  WAREHOUSE_MANAGER: [
    'stock:entry',
    'stock:shrinkage',
    'transfer:create',
    'transfer:dispatch',
    'transfer:receive',
    'transfer:resolve',
    'reports:view',
  ],
  OPERATOR: ['stock:shrinkage', 'transfer:create', 'transfer:receive'],
  AUDITOR: ['reports:view'],
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

export const ROLES: readonly Role[] = ['ADMIN', 'WAREHOUSE_MANAGER', 'OPERATOR', 'AUDITOR']

/**
 * ¿El rol trabaja solo sobre las bodegas que tiene asignadas? El ADMIN y el AUDITOR tienen alcance
 * global (ven todas), así que a ellos no se les asignan bodegas.
 */
export function roleUsesWarehouses(role: Role): boolean {
  return role === 'WAREHOUSE_MANAGER' || role === 'OPERATOR'
}
