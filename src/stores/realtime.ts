import { ref } from 'vue'
import { defineStore } from 'pinia'
import { TRANSFER_STATUS_LABELS } from '@/transfers'
import { useAuthStore } from './auth'
import { useDashboardStore } from './dashboard'
import { useStockStore } from './stock'
import { useTransfersStore } from './transfers'
import type {
  RealtimeEvent,
  RealtimeNotice,
  RealtimeScreen,
  RealtimeStatus,
} from '@/types/realtime'

/** Cuánto se ve un aviso antes de desaparecer solo, y cuántos se muestran a la vez como máximo. */
export const NOTICE_TTL_MS = 10_000
const MAX_NOTICES = 3

/**
 * Store del tiempo real: el estado de la conexión (para el indicador), los avisos visibles y qué
 * hacer con cada evento que llega. La conexión en sí la maneja el composable `useRealtime`.
 */
export const useRealtimeStore = defineStore('realtime', () => {
  const status = ref<RealtimeStatus>('disconnected')
  const notices = ref<RealtimeNotice[]>([])
  let nextNoticeId = 1

  function setStatus(next: RealtimeStatus): void {
    status.value = next
  }

  function notify(text: string, to: string | null = null): void {
    const notice: RealtimeNotice = { id: nextNoticeId++, text, to }
    notices.value = [...notices.value, notice].slice(-MAX_NOTICES)
    setTimeout(() => dismiss(notice.id), NOTICE_TTL_MS)
  }

  function dismiss(id: number): void {
    notices.value = notices.value.filter((notice) => notice.id !== id)
  }

  /**
   * Procesa un evento: descarta la caché de los stores afectados, vuelve a pedir lo que está en
   * pantalla y muestra un aviso si corresponde. Los eventos no traen costos: los datos llegan otra
   * vez por la API, que ya filtra por rol.
   */
  async function handleEvent(event: RealtimeEvent, screen: RealtimeScreen): Promise<void> {
    // Cualquier cambio de stock o de un traspaso mueve los totales del dashboard
    void refreshDashboard(screen)
    if (event.type === 'stock.changed') {
      await useStockStore().refreshAfterEvent(event.payload.warehouseId, screen.name === 'stock')
      return
    }

    const transfers = useTransfersStore()
    const { transferId, status: newStatus, destinationWarehouseId } = event.payload
    const viewing = screen.name === 'transfer-detail' && screen.transferId === transferId
    // Si esta misma pestaña está haciendo una acción, el aviso sería de su propio cambio
    const ownAction = transfers.acting
    const previousStatus = transfers.details[transferId]?.status

    await transfers.refreshAfterEvent(transferId, {
      list: screen.name === 'transfers',
      detail: viewing,
    })

    if (ownAction) return
    if (viewing) {
      if (previousStatus !== newStatus) {
        notify(`Este traspaso cambió a «${TRANSFER_STATUS_LABELS[newStatus]}».`)
      }
      return
    }
    if (newStatus === 'IN_TRANSIT' && useAuthStore().can('transfer:receive')) {
      // Las bodegas asignadas (con caché): solo se avisa si el destino es una de ellas
      await transfers.loadWarehouses()
      const destination = transfers.origins.find((w) => w.id === destinationWarehouseId)
      if (destination) {
        notify(`Va en camino un traspaso hacia ${destination.name}.`, `/traspasos/${transferId}`)
      }
    }
  }

  /** El dashboard solo se vuelve a pedir si está en pantalla y el rol lo ve (datos de costo). */
  function refreshDashboard(screen: RealtimeScreen): Promise<void> {
    const onScreen = screen.name === 'home' && useAuthStore().can('reports:view')
    return useDashboardStore().refreshAfterEvent(onScreen)
  }

  /**
   * Tras reconectar se pudieron perder eventos: se descarta todo y se vuelve a pedir lo que está en
   * pantalla (la BD es la fuente de verdad).
   */
  async function resync(screen: RealtimeScreen): Promise<void> {
    const stock = useStockStore()
    await Promise.all([
      useTransfersStore().refreshAfterEvent(screen.transferId ?? '', {
        list: screen.name === 'transfers',
        detail: screen.name === 'transfer-detail' && screen.transferId !== null,
      }),
      stock.refreshAfterEvent(stock.warehouseId, screen.name === 'stock'),
      refreshDashboard(screen),
    ])
  }

  return { status, notices, setStatus, notify, dismiss, handleEvent, resync }
})
