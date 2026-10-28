<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TransferItem, TransferReceiveInput } from '@/types/transfer'

const MAX_QUANTITY = 1_000_000_000

const props = defineProps<{
  items: TransferItem[]
  saving: boolean
}>()
const emit = defineEmits<{ submit: [input: TransferReceiveInput] }>()

// Cantidad escrita por producto. Empieza vacía: quien recibe debe contar, no confirmar lo enviado.
const received = ref<Record<string, string>>(
  Object.fromEntries(props.items.map((item) => [item.productId, ''])),
)
const touched = ref(false)

function quantityError(value: string | undefined): string | null {
  const text = (value ?? '').trim()
  if (!text) return 'Indica la cantidad recibida'
  if (!/^\d+$/.test(text)) return 'Debe ser un entero mayor o igual a 0'
  if (Number(text) > MAX_QUANTITY) return `No puede superar ${MAX_QUANTITY}`
  return null
}

const errors = computed<Record<string, string | null>>(() =>
  Object.fromEntries(
    props.items.map((item) => [item.productId, quantityError(received.value[item.productId])]),
  ),
)
const hasErrors = computed(() => Object.values(errors.value).some((error) => error !== null))

// Aviso antes de enviar: si algo no coincide, el traspaso quedará con discrepancia
const willHaveDiscrepancy = computed(
  () =>
    !hasErrors.value &&
    props.items.some((item) => Number(received.value[item.productId]) !== item.quantitySent),
)

function onSubmit(): void {
  touched.value = true
  if (hasErrors.value) return
  emit('submit', {
    items: props.items.map((item) => ({
      productId: item.productId,
      receivedQuantity: Number((received.value[item.productId] ?? '').trim()),
    })),
  })
}
</script>

<template>
  <form class="receive" novalidate @submit.prevent="onSubmit">
    <h2>Registrar la recepción</h2>
    <p class="hint">
      Cuenta lo que llegó y escribe la cantidad de cada producto. Lo enviado es solo la referencia.
    </p>
    <table>
      <thead>
        <tr>
          <th>Producto</th>
          <th class="num">Enviado</th>
          <th>Recibido</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.productId">
          <td>{{ item.productSku }} · {{ item.productName }}</td>
          <td class="num">{{ item.quantitySent }}</td>
          <td>
            <input
              v-model="received[item.productId]"
              :name="`received-${item.productId}`"
              :aria-label="`Recibido de ${item.productSku}`"
              type="text"
              inputmode="numeric"
              :disabled="saving"
            />
            <p v-if="touched && errors[item.productId]" class="field-error" role="alert">
              {{ errors[item.productId] }}
            </p>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-if="willHaveDiscrepancy" class="warning" data-test="discrepancy-warning">
      Lo recibido no coincide con lo enviado: el traspaso quedará con discrepancia hasta que otra
      persona la resuelva.
    </p>

    <button type="submit" :disabled="saving">
      {{ saving ? 'Procesando…' : 'Registrar recepción' }}
    </button>
  </form>
</template>

<style scoped>
.receive {
  margin: 1rem 0;
  padding: 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}
.receive h2 {
  margin-top: 0;
  font-size: 1.1rem;
}
.hint {
  color: #4b5563;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 0.75rem;
}
th,
td {
  padding: 0.5rem;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
  vertical-align: top;
}
.num {
  text-align: right;
}
input {
  width: 8rem;
}
.field-error {
  margin: 0.25rem 0 0;
  color: #b91c1c;
}
.warning {
  color: #92400e;
}
</style>
