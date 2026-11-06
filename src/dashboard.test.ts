import { describe, expect, it } from 'vitest'
import { formatMoney, inventorySeries, totalTransfers, transfersSeries } from './dashboard'
import { dashboardSummary } from './testing'

const SUMMARY = dashboardSummary()

/** Quita los espacios especiales que pone Intl (varían según el motor) para comparar el texto. */
function plain(text: string): string {
  return text.replace(/\s/g, ' ')
}

describe('formatMoney', () => {
  it('muestra pesos con separadores en español y dos decimales', () => {
    expect(plain(formatMoney('1249.4112'))).toBe('$ 1.249,41')
    expect(plain(formatMoney('0.0000'))).toBe('$ 0,00')
  })

  it('un texto que no es número se muestra tal cual', () => {
    expect(formatMoney('n/d')).toBe('n/d')
  })
})

describe('series de los gráficos', () => {
  it('inventario: una barra por bodega con su código y nombre', () => {
    expect(inventorySeries(SUMMARY)).toEqual({
      labels: ['A · Bodega A', 'B · Bodega B'],
      values: [1249.4112, 450],
    })
  })

  it('traspasos: todos los estados en el orden del flujo, con etiquetas en español', () => {
    expect(transfersSeries(SUMMARY)).toEqual({
      labels: ['Borrador', 'En tránsito', 'Recibido', 'Con discrepancia', 'Resuelto', 'Cancelado'],
      values: [2, 1, 3, 1, 1, 0],
    })
  })

  it('total de traspasos', () => {
    expect(totalTransfers(SUMMARY)).toBe(8)
  })
})
