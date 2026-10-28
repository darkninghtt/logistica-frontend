<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import TransferDiscrepancy from '@/components/TransferDiscrepancy.vue'
import TransferReceiveForm from '@/components/TransferReceiveForm.vue'
import TransferResolveForm from '@/components/TransferResolveForm.vue'
import { TRANSFER_STATUS_LABELS } from '@/transfers'
import { useAuthStore } from '@/stores/auth'
import { useTransfersStore } from '@/stores/transfers'
import type { TransferReceiveInput } from '@/types/transfer'

const auth = useAuthStore()
const store = useTransfersStore()
const route = useRoute()

const id = computed(() => {
  const param = route.params.id
  return typeof param === 'string' ? param : (param?.[0] ?? '')
})
const detail = computed(() => store.details[id.value])

// El OPERATOR no recibe costos: la API no los envía y la columna no se muestra
const hasCosts = computed(() => detail.value?.items.some((item) => item.unitCost !== undefined))
const hasReceived = computed(() =>
  detail.value?.items.some((item) => item.quantityReceived !== null),
)

// `store.origins` son las bodegas asignadas a quien mira. Despachar y cancelar son del origen;
// recibir, del destino; resolver, del jefe de cualquiera de las dos.
function isAssigned(warehouseId: string | undefined): boolean {
  return store.origins.some((warehouse) => warehouse.id === warehouseId)
}
const ownsOrigin = computed(() => isAssigned(detail.value?.origin.id))
const ownsDestination = computed(() => isAssigned(detail.value?.destination.id))

// Botones por permiso, bodega y estado (comodidad: la API repite la comprobación y responde 403)
const canDispatch = computed(
  () => auth.can('transfer:dispatch') && ownsOrigin.value && detail.value?.status === 'DRAFT',
)
const canCancel = computed(() => {
  const transfer = detail.value
  if (!transfer || transfer.status !== 'DRAFT' || !auth.can('transfer:create')) return false
  if (!ownsOrigin.value) return false
  // El operario solo cancela los traspasos que él creó
  return auth.user?.role !== 'OPERATOR' || transfer.createdBy === auth.user.id
})

const canReceive = computed(
  () =>
    auth.can('transfer:receive') && ownsDestination.value && detail.value?.status === 'IN_TRANSIT',
)

// Separación de funciones: quien registró la recepción no puede resolver su discrepancia
const isReceiver = computed(
  () => detail.value?.receivedBy !== null && detail.value?.receivedBy === auth.user?.id,
)
const canResolve = computed(() => {
  if (detail.value?.status !== 'DISCREPANCY' || !auth.can('transfer:resolve')) return false
  if (isReceiver.value) return false
  return auth.user?.role === 'ADMIN' || ownsOrigin.value || ownsDestination.value
})
const showDiscrepancy = computed(
  () => detail.value?.status === 'DISCREPANCY' || detail.value?.status === 'RESOLVED',
)

const cancelling = ref(false)
const reason = ref('')

function load(): void {
  store.clearActionError()
  cancelling.value = false
  reason.value = ''
  void store.fetchDetail(id.value)
}

onMounted(() => {
  // Las bodegas asignadas deciden qué acciones se ofrecen (no hace falta para el AUDITOR ni el ADMIN)
  if (auth.can('transfer:create')) void store.loadWarehouses()
})

onMounted(load)
watch(id, load)

async function onDispatch(): Promise<void> {
  await store.dispatch(id.value)
}

async function onCancel(): Promise<void> {
  if (await store.cancel(id.value, reason.value.trim() || undefined)) {
    cancelling.value = false
    reason.value = ''
  }
}

async function onReceive(input: TransferReceiveInput): Promise<void> {
  await store.receive(id.value, input)
}

async function onResolve(reason: string): Promise<void> {
  await store.resolve(id.value, reason)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-CO')
}
</script>

<template>
  <section>
    <p><RouterLink to="/traspasos">← Volver a los traspasos</RouterLink></p>

    <p v-if="!detail && (store.detailStatus === 'loading' || store.detailStatus === 'idle')">
      Cargando el traspaso…
    </p>

    <div v-else-if="!detail" role="alert">
      <p>No se pudo cargar el traspaso: {{ store.detailError }}</p>
      <button type="button" @click="store.fetchDetail(id, { force: true })">Reintentar</button>
    </div>

    <template v-else>
      <div class="header">
        <h1>
          Traspaso {{ detail.origin.code }} → {{ detail.destination.code }}
          <span class="status" :data-status="detail.status" data-test="status">
            {{ TRANSFER_STATUS_LABELS[detail.status] }}
          </span>
        </h1>
        <div class="actions">
          <button v-if="canDispatch" type="button" :disabled="store.acting" @click="onDispatch">
            {{ store.acting ? 'Procesando…' : 'Despachar' }}
          </button>
          <button
            v-if="canCancel && !cancelling"
            type="button"
            :disabled="store.acting"
            @click="cancelling = true"
          >
            Cancelar traspaso
          </button>
        </div>
      </div>

      <form v-if="canCancel && cancelling" class="cancel" @submit.prevent="onCancel">
        <label>
          Motivo de la cancelación (opcional)
          <input v-model="reason" name="reason" type="text" maxlength="500" />
        </label>
        <button type="submit" :disabled="store.acting">Confirmar cancelación</button>
        <button type="button" :disabled="store.acting" @click="cancelling = false">Volver</button>
      </form>

      <p v-if="store.actionError" class="field-error" role="alert">{{ store.actionError }}</p>

      <dl class="summary">
        <dt>Origen</dt>
        <dd>{{ detail.origin.code }} · {{ detail.origin.name }}</dd>
        <dt>Destino</dt>
        <dd>{{ detail.destination.code }} · {{ detail.destination.name }}</dd>
        <dt>Creado</dt>
        <dd>{{ formatDate(detail.createdAt) }}</dd>
        <template v-if="detail.note">
          <dt>Nota</dt>
          <dd>{{ detail.note }}</dd>
        </template>
      </dl>

      <h2>Productos</h2>
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Enviado</th>
            <th v-if="hasReceived">Recibido</th>
            <th v-if="hasCosts">Costo unitario</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in detail.items" :key="item.productId">
            <td>{{ item.productSku }} · {{ item.productName }}</td>
            <td>{{ item.quantitySent }}</td>
            <td v-if="hasReceived">{{ item.quantityReceived ?? '—' }}</td>
            <td v-if="hasCosts">{{ item.unitCost ? `$${item.unitCost}` : '—' }}</td>
          </tr>
        </tbody>
      </table>

      <TransferReceiveForm
        v-if="canReceive"
        :key="detail.id"
        :items="detail.items"
        :saving="store.acting"
        @submit="onReceive"
      />

      <template v-if="showDiscrepancy">
        <TransferDiscrepancy :items="detail.items" :resolved="detail.status === 'RESOLVED'" />
        <TransferResolveForm v-if="canResolve" :saving="store.acting" @submit="onResolve" />
        <p
          v-else-if="detail.status === 'DISCREPANCY' && isReceiver"
          class="hint"
          data-test="receiver-note"
        >
          Tú registraste la recepción: la discrepancia la resuelve otra persona (el ADMIN o un jefe
          del origen o del destino).
        </p>
      </template>

      <h2>Historial</h2>
      <ol class="events">
        <li v-for="(event, index) in detail.events" :key="index">
          <strong>{{ TRANSFER_STATUS_LABELS[event.toStatus] }}</strong>
          <template v-if="event.fromStatus">
            (antes: {{ TRANSFER_STATUS_LABELS[event.fromStatus] }})
          </template>
          · {{ event.actor.name }} · {{ formatDate(event.createdAt) }}
          <template v-if="event.reason"> · {{ event.reason }}</template>
        </li>
      </ol>
    </template>
  </section>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.actions {
  display: flex;
  gap: 0.5rem;
}
.cancel {
  display: flex;
  align-items: end;
  gap: 0.5rem;
  margin: 0.5rem 0;
}
.cancel label {
  display: grid;
  gap: 0.25rem;
  flex: 1;
}
.field-error {
  color: #b91c1c;
}
.hint {
  color: #4b5563;
}
.summary {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.25rem 1rem;
}
.summary dt {
  font-weight: 600;
}
.summary dd {
  margin: 0;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: 0.5rem;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}
.status {
  margin-left: 0.5rem;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: #e5e7eb;
  font-size: 0.85rem;
  font-weight: normal;
}
.status[data-status='IN_TRANSIT'] {
  background: #dbeafe;
}
.status[data-status='RECEIVED'],
.status[data-status='RESOLVED'] {
  background: #dcfce7;
}
.status[data-status='DISCREPANCY'] {
  background: #fee2e2;
}
.events {
  padding-left: 1.25rem;
}
</style>
