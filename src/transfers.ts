import type { TransferItem, TransferStatus } from '@/types/transfer'

/** Nombre en español de cada estado del traspaso. */
export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
  DRAFT: 'Borrador',
  IN_TRANSIT: 'En tránsito',
  RECEIVED: 'Recibido',
  DISCREPANCY: 'Con discrepancia',
  RESOLVED: 'Resuelto',
  CANCELLED: 'Cancelado',
}

/** Estados en el orden en que se ofrecen en el filtro del listado. */
export const TRANSFER_STATUSES: readonly TransferStatus[] = [
  'DRAFT',
  'IN_TRANSIT',
  'RECEIVED',
  'DISCREPANCY',
  'RESOLVED',
  'CANCELLED',
]

/** Diferencia de un ítem entre lo enviado y lo recibido. */
export interface ItemDifference {
  productId: string
  productSku: string
  productName: string
  sent: number
  received: number
  /** recibido - enviado: negativo es faltante, positivo es sobrante. */
  difference: number
  kind: 'shortage' | 'surplus' | 'match'
}

/**
 * Compara lo enviado con lo recibido por ítem (solo los que ya tienen recepción). Es lo que el
 * backend deja retenido al pasar a DISCREPANCY: al resolver, el faltante se registra como merma
 * en tránsito y el sobrante como ajuste de entrada, los dos al costo congelado.
 */
export function itemDifferences(items: readonly TransferItem[]): ItemDifference[] {
  return items.flatMap((item) => {
    if (item.quantityReceived === null) return []
    const difference = item.quantityReceived - item.quantitySent
    const kind = difference < 0 ? 'shortage' : difference > 0 ? 'surplus' : 'match'
    return [
      {
        productId: item.productId,
        productSku: item.productSku,
        productName: item.productName,
        sent: item.quantitySent,
        received: item.quantityReceived,
        difference,
        kind,
      },
    ]
  })
}
