import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import type { Role } from '@/types/auth'
import type { DashboardSummary } from '@/types/report'

/** Pinia con una sesión ya iniciada con ese rol, para montar vistas que dependen del rol. */
export function piniaSignedInAs(role: Role): Pinia {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore(pinia).user = { id: `u-${role}`, name: 'Usuario de prueba', email: 'u@b.co', role }
  return pinia
}

/** Resumen del dashboard de ejemplo (bodegas A y B, traspasos en todos los estados salvo cancelado). */
export function dashboardSummary(): DashboardSummary {
  return {
    inventoryValueByWarehouse: [
      { warehouseId: 'wa', code: 'A', name: 'Bodega A', value: '1249.4112' },
      { warehouseId: 'wb', code: 'B', name: 'Bodega B', value: '450.0000' },
    ],
    transfersByStatus: {
      DRAFT: 2,
      IN_TRANSIT: 1,
      RECEIVED: 3,
      DISCREPANCY: 1,
      RESOLVED: 1,
      CANCELLED: 0,
    },
    shrinkageLast30Days: { quantity: 5, value: '492.3528' },
    inTransitValue: '208.2352',
  }
}
