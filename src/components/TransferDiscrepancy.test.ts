import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TransferDiscrepancy from './TransferDiscrepancy.vue'
import type { TransferItem } from '@/types/transfer'

function item(productId: string, sent: number, received: number): TransferItem {
  return {
    productId,
    productSku: `S-${productId}`,
    productName: `Producto ${productId}`,
    quantitySent: sent,
    quantityReceived: received,
    unitCost: '110.0000',
  }
}

const items = [item('a', 8, 7), item('b', 5, 6), item('c', 3, 3)]

describe('TransferDiscrepancy', () => {
  it('muestra enviado, recibido y diferencia solo de los ítems que no coinciden', () => {
    const wrapper = mount(TransferDiscrepancy, { props: { items, resolved: false } })

    const rows = wrapper.findAll('tbody tr').map((row) => row.findAll('td').map((c) => c.text()))
    expect(rows).toEqual([
      ['S-a · Producto a', '8', '7', '-1', 'Faltante: merma en tránsito de 1 u'],
      ['S-b · Producto b', '5', '6', '+1', 'Sobrante: ajuste de entrada de 1 u'],
    ])
  })

  it('cambia el título y la explicación cuando ya se resolvió', () => {
    const pending = mount(TransferDiscrepancy, { props: { items, resolved: false } })
    const resolved = mount(TransferDiscrepancy, { props: { items, resolved: true } })

    expect(pending.find('h2').text()).toBe('Discrepancia pendiente')
    expect(pending.text()).toContain('está retenida')
    expect(resolved.find('h2').text()).toBe('Discrepancia resuelta')
    expect(resolved.text()).toContain('merma en tránsito')
  })
})
