import { describe, expect, it } from 'vitest'
import { inventorySeries, totalTransfers, transfersSeries } from './dashboard'
import { dashboardSummary } from './testing'

const SUMMARY = dashboardSummary()

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
