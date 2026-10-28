import { describe, expect, it } from 'vitest'
import { itemDifferences } from './transfers'
import type { TransferItem } from '@/types/transfer'

function item(productId: string, sent: number, received: number | null): TransferItem {
  return {
    productId,
    productSku: `S-${productId}`,
    productName: `Producto ${productId}`,
    quantitySent: sent,
    quantityReceived: received,
  }
}

describe('itemDifferences', () => {
  it('clasifica faltante, sobrante y coincidencia con la diferencia recibido - enviado', () => {
    const result = itemDifferences([item('a', 8, 7), item('b', 5, 6), item('c', 3, 3)])
    expect(result.map((d) => [d.productId, d.difference, d.kind])).toEqual([
      ['a', -1, 'shortage'],
      ['b', 1, 'surplus'],
      ['c', 0, 'match'],
    ])
  })

  it('recibido cero es un faltante de todo lo enviado', () => {
    expect(itemDifferences([item('a', 4, 0)])[0]).toMatchObject({
      sent: 4,
      received: 0,
      difference: -4,
      kind: 'shortage',
    })
  })

  it('omite los ítems que todavía no tienen recepción', () => {
    expect(itemDifferences([item('a', 8, null)])).toEqual([])
  })
})
