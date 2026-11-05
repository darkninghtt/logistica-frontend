import { describe, expect, it } from 'vitest'
import { parseRealtimeEvent, realtimeUrl, reconnectDelay, screenFromRoute } from './realtime'

describe('reconnectDelay', () => {
  it('crece al doble en cada intento: 1 s, 2 s, 4 s, 8 s', () => {
    expect([0, 1, 2, 3].map(reconnectDelay)).toEqual([1000, 2000, 4000, 8000])
  })

  it('no pasa de 30 s', () => {
    expect(reconnectDelay(5)).toBe(30_000)
    expect(reconnectDelay(20)).toBe(30_000)
  })
})

describe('realtimeUrl', () => {
  it('usa wss en https (Render) y el mismo host', () => {
    expect(realtimeUrl('abc', { protocol: 'https:', host: 'app.onrender.com' })).toBe(
      'wss://app.onrender.com/api/realtime?ticket=abc',
    )
  })

  it('usa ws en http (local) y codifica el ticket', () => {
    expect(realtimeUrl('a+b/c', { protocol: 'http:', host: 'localhost:5173' })).toBe(
      'ws://localhost:5173/api/realtime?ticket=a%2Bb%2Fc',
    )
  })
})

describe('parseRealtimeEvent', () => {
  const transfer = {
    type: 'transfer.updated',
    payload: {
      transferId: 't1',
      status: 'IN_TRANSIT',
      originWarehouseId: 'wa',
      destinationWarehouseId: 'wb',
    },
  }

  it('acepta un transfer.updated válido', () => {
    expect(parseRealtimeEvent(JSON.stringify(transfer))).toEqual(transfer)
  })

  it('acepta un stock.changed válido', () => {
    const event = { type: 'stock.changed', payload: { warehouseId: 'wa', productIds: ['p1'] } }
    expect(parseRealtimeEvent(JSON.stringify(event))).toEqual(event)
  })

  it('descarta campos que no conoce', () => {
    const extra = { ...transfer, payload: { ...transfer.payload, unitCost: '10.0000' } }
    expect(parseRealtimeEvent(JSON.stringify(extra))).toEqual(transfer)
  })

  it.each([
    ['texto que no es JSON', 'hola'],
    ['JSON que no es objeto', '[1,2]'],
    ['sin payload', JSON.stringify({ type: 'transfer.updated' })],
    ['tipo desconocido', JSON.stringify({ type: 'user.deleted', payload: {} })],
    [
      'estado inválido',
      JSON.stringify({ ...transfer, payload: { ...transfer.payload, status: 'LOST' } }),
    ],
    ['id vacío', JSON.stringify({ ...transfer, payload: { ...transfer.payload, transferId: '' } })],
    [
      'productIds que no es lista de textos',
      JSON.stringify({ type: 'stock.changed', payload: { warehouseId: 'wa', productIds: [1] } }),
    ],
  ])('devuelve null con %s', (_case, raw) => {
    expect(parseRealtimeEvent(raw)).toBeNull()
  })
})

describe('screenFromRoute', () => {
  it('toma el id solo en el detalle del traspaso', () => {
    expect(screenFromRoute('transfer-detail', 't1')).toEqual({
      name: 'transfer-detail',
      transferId: 't1',
    })
    expect(screenFromRoute('stock', 't1')).toEqual({ name: 'stock', transferId: null })
  })

  it('tolera rutas sin nombre y parámetros repetidos', () => {
    expect(screenFromRoute(undefined, undefined)).toEqual({ name: null, transferId: null })
    expect(screenFromRoute('transfer-detail', ['t2', 't3'])).toEqual({
      name: 'transfer-detail',
      transferId: 't2',
    })
  })
})
