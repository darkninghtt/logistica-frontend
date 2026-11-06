import { describe, expect, it } from 'vitest'
import { formatCost, formatDate, formatDateTime, formatMoney } from './format'
import { plain } from './testing'

describe('formatMoney', () => {
  it('muestra pesos con separadores en español y dos decimales', () => {
    expect(plain(formatMoney('1249.4112'))).toBe('$ 1.249,41')
    expect(plain(formatMoney('0.0000'))).toBe('$ 0,00')
  })

  it('un texto que no es número se muestra tal cual', () => {
    expect(formatMoney('n/d')).toBe('n/d')
    expect(formatMoney('')).toBe('')
  })
})

describe('formatCost', () => {
  it('conserva los decimales del costo, entre dos y cuatro', () => {
    expect(plain(formatCost('104.1176'))).toBe('$ 104,1176')
    expect(plain(formatCost('110.0000'))).toBe('$ 110,00')
    expect(plain(formatCost('12000.5000'))).toBe('$ 12.000,50')
  })

  it('sin valor muestra una raya', () => {
    expect(formatCost(null)).toBe('—')
    expect(formatMoney(undefined)).toBe('—')
  })
})

describe('fechas', () => {
  it('se muestran en la hora de Colombia, sin importar la zona del navegador', () => {
    // 01:30 UTC del 6 de noviembre son las 8:30 p. m. del 5 en Bogotá
    expect(plain(formatDateTime('2026-11-06T01:30:00.000Z'))).toMatch(/^5\/11\/2026, 8:30 p\. m\.$/)
    expect(formatDate('2026-11-06T01:30:00.000Z')).toBe('5/11/2026')
  })

  it('un texto que no es fecha se muestra tal cual', () => {
    expect(formatDateTime('ayer')).toBe('ayer')
    expect(formatDate('ayer')).toBe('ayer')
  })
})
