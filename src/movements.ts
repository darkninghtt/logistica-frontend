import type { MovementType } from '@/types/stockEntry'
import type { ShrinkageReason } from '@/types/stockShrinkage'

/** Nombre en español de cada tipo de movimiento del libro. */
export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  ENTRY: 'Entrada',
  TRANSFER_OUT: 'Salida por traspaso',
  TRANSFER_IN: 'Entrada por traspaso',
  SHRINKAGE: 'Merma',
  TRANSIT_SHRINKAGE: 'Merma en tránsito',
  ADJUSTMENT_IN: 'Ajuste de entrada',
}

export const SHRINKAGE_REASON_LABELS: Record<ShrinkageReason, string> = {
  DAMAGE: 'Daño',
  EXPIRED: 'Vencimiento',
  THEFT: 'Robo',
  COUNT_ADJUSTMENT: 'Ajuste de conteo',
}

/**
 * Efecto del movimiento sobre el saldo de la bodega: suma, resta o ninguno. La merma en tránsito
 * no cambia el stock (la mercancía ya había salido del origen); su cantidad es informativa.
 */
export function movementDirection(type: MovementType): 'in' | 'out' | 'none' {
  if (type === 'TRANSFER_OUT' || type === 'SHRINKAGE') return 'out'
  if (type === 'TRANSIT_SHRINKAGE') return 'none'
  return 'in'
}

/** Cantidad con su signo según el efecto sobre el saldo: "+5", "-2" o "5" (informativa). */
export function signedQuantity(type: MovementType, quantity: number): string {
  const direction = movementDirection(type)
  if (direction === 'in') return `+${quantity}`
  if (direction === 'out') return `-${quantity}`
  return String(quantity)
}

function isShrinkageReason(value: string): value is ShrinkageReason {
  // hasOwn y no `in`: `in` también acepta nombres heredados como "constructor"
  return Object.hasOwn(SHRINKAGE_REASON_LABELS, value)
}

/**
 * Motivo legible. Las mermas guardan "CÓDIGO" o "CÓDIGO: nota" (el código va antes del primer
 * ": "), así que el código se traduce; cualquier otro motivo (por ejemplo, el de resolver una
 * discrepancia) se muestra tal cual.
 */
export function formatMovementReason(reason: string | null): string {
  if (!reason) return ''
  const separator = reason.indexOf(': ')
  const code = separator === -1 ? reason : reason.slice(0, separator)
  if (!isShrinkageReason(code)) return reason
  const label = SHRINKAGE_REASON_LABELS[code]
  return separator === -1 ? label : `${label}: ${reason.slice(separator + 2)}`
}
