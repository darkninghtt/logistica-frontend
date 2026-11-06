import { TRANSFER_STATUS_LABELS, TRANSFER_STATUSES } from './transfers'
import type { DashboardSummary } from './types/report'

const MONEY = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Muestra un valor de la API ("1249.4112") como moneda en español ("$ 1.249,41"). Solo es para
 * mostrar: no se hacen cuentas con el número (las sumas ya llegan hechas por el backend con
 * decimal.js). Un texto que no es número se muestra tal cual.
 */
export function formatMoney(value: string): string {
  const amount = Number(value)
  return Number.isFinite(amount) ? MONEY.format(amount) : value
}

/** Datos que recibe un gráfico: etiquetas y un número por etiqueta. */
export interface ChartSeries {
  labels: string[]
  values: number[]
}

/**
 * Valor del inventario por bodega para el gráfico de barras. Chart.js necesita números: la
 * conversión es solo para dibujar la altura de cada barra.
 */
export function inventorySeries(summary: DashboardSummary): ChartSeries {
  return {
    labels: summary.inventoryValueByWarehouse.map((w) => `${w.code} · ${w.name}`),
    values: summary.inventoryValueByWarehouse.map((w) => Number(w.value)),
  }
}

/** Traspasos por estado, en el orden del flujo y con las etiquetas en español. */
export function transfersSeries(summary: DashboardSummary): ChartSeries {
  return {
    labels: TRANSFER_STATUSES.map((status) => TRANSFER_STATUS_LABELS[status]),
    values: TRANSFER_STATUSES.map((status) => summary.transfersByStatus[status]),
  }
}

/** Total de traspasos (de todos los estados). */
export function totalTransfers(summary: DashboardSummary): number {
  return TRANSFER_STATUSES.reduce((sum, status) => sum + summary.transfersByStatus[status], 0)
}
