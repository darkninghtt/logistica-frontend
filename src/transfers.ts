import type { TransferStatus } from '@/types/transfer'

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
