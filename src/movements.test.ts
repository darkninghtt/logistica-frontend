import { describe, expect, it } from 'vitest'
import { formatMovementReason, movementDirection, signedQuantity } from './movements'

describe('movementDirection', () => {
  it.each([
    ['ENTRY', 'in'],
    ['TRANSFER_IN', 'in'],
    ['ADJUSTMENT_IN', 'in'],
    ['TRANSFER_OUT', 'out'],
    ['SHRINKAGE', 'out'],
    ['TRANSIT_SHRINKAGE', 'none'],
  ] as const)('%s → %s', (type, expected) => {
    expect(movementDirection(type)).toBe(expected)
  })
})

describe('signedQuantity', () => {
  it('pone + a lo que entra, - a lo que sale y nada a la merma en tránsito', () => {
    expect(signedQuantity('ENTRY', 5)).toBe('+5')
    expect(signedQuantity('SHRINKAGE', 2)).toBe('-2')
    expect(signedQuantity('TRANSIT_SHRINKAGE', 1)).toBe('1')
  })
})

describe('formatMovementReason', () => {
  it('traduce el código de una merma, con o sin nota', () => {
    expect(formatMovementReason('DAMAGE')).toBe('Daño')
    expect(formatMovementReason('COUNT_ADJUSTMENT: faltó en el conteo')).toBe(
      'Ajuste de conteo: faltó en el conteo',
    )
  })

  it('solo separa en el primer ": " (la nota puede traer más)', () => {
    expect(formatMovementReason('THEFT: denuncia: 123')).toBe('Robo: denuncia: 123')
  })

  it('deja tal cual los motivos que no son códigos de merma', () => {
    expect(formatMovementReason('Caja rota en el camión')).toBe('Caja rota en el camión')
    expect(formatMovementReason('Nota: revisar')).toBe('Nota: revisar')
    expect(formatMovementReason('constructor')).toBe('constructor')
  })

  it('sin motivo devuelve texto vacío', () => {
    expect(formatMovementReason(null)).toBe('')
  })
})
