/**
 * Formato de montos y fechas para mostrar en pantalla, en español de Colombia. Es solo para mostrar:
 * no se hacen cuentas con el número (los cálculos ya llegan hechos por el backend con decimal.js).
 */

const MONEY = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

// Los costos unitarios y el CPP se guardan con 4 decimales: se muestran todos los que tengan
const COST = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
})

// Las fechas se muestran en la hora de Colombia, la misma que usa el backend para los reportes
const DATE_TIME = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
})

const DATE = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'America/Bogota' })

/** Lo que se muestra cuando no hay valor (un costo que no aplica, por ejemplo). */
export const EMPTY_VALUE = '—'

function formatNumeric(format: Intl.NumberFormat, value: string | null | undefined): string {
  if (value === null || value === undefined) return EMPTY_VALUE
  const amount = Number(value)
  return value.trim() !== '' && Number.isFinite(amount) ? format.format(amount) : value
}

/** Un valor total de la API ("1249.4112") como pesos con dos decimales ("$ 1.249,41"). */
export function formatMoney(value: string | null | undefined): string {
  return formatNumeric(MONEY, value)
}

/**
 * Un costo unitario o un CPP ("104.1176") como pesos con hasta cuatro decimales ("$ 104,1176").
 * Sin valor (null o undefined) muestra una raya.
 */
export function formatCost(value: string | null | undefined): string {
  return formatNumeric(COST, value)
}

/** Fecha y hora de la API (ISO) en la hora de Colombia, por ejemplo "5/11/2026, 3:04 p. m.". */
export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : DATE_TIME.format(date)
}

/** Solo la fecha, en la hora de Colombia. */
export function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : DATE.format(date)
}
