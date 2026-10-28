<script setup lang="ts">
import { computed, ref } from 'vue'
import { SHRINKAGE_REASON_LABELS } from '@/movements'
import type { Product } from '@/types/product'
import type { ShrinkageReason, StockShrinkageInput } from '@/types/stockShrinkage'
import type { Warehouse } from '@/types/warehouse'

const MAX_QUANTITY = 1_000_000_000
const MAX_NOTE_LENGTH = 500

defineProps<{
  warehouses: Warehouse[]
  products: Product[]
  saving: boolean
  /** Error devuelto por la API al registrar (por ejemplo, stock insuficiente). */
  serverError: string | null
}>()
const emit = defineEmits<{ submit: [input: StockShrinkageInput] }>()

const reasonOptions = Object.entries(SHRINKAGE_REASON_LABELS).flatMap(([value, label]) =>
  isReason(value) ? [{ value, label }] : [],
)

function isReason(value: string): value is ShrinkageReason {
  return Object.hasOwn(SHRINKAGE_REASON_LABELS, value)
}

const warehouseId = ref('')
const productId = ref('')
const quantity = ref('')
const reason = ref('')
const note = ref('')
const touched = ref(false)

const warehouseError = computed(() => (warehouseId.value ? null : 'Elige una bodega'))
const productError = computed(() => (productId.value ? null : 'Elige un producto'))
const quantityError = computed(() => {
  const value = quantity.value.trim()
  if (!value) return 'La cantidad es obligatoria'
  if (!/^\d+$/.test(value) || Number(value) < 1) return 'La cantidad debe ser un entero mayor que 0'
  if (Number(value) > MAX_QUANTITY) return `La cantidad no puede superar ${MAX_QUANTITY}`
  return null
})
const reasonError = computed(() => (isReason(reason.value) ? null : 'Elige un motivo'))
const noteError = computed(() =>
  note.value.trim().length > MAX_NOTE_LENGTH
    ? `La nota no puede superar ${MAX_NOTE_LENGTH} caracteres`
    : null,
)

/** Limpia cantidad, motivo y nota (se conservan bodega y producto). */
function reset(): void {
  quantity.value = ''
  reason.value = ''
  note.value = ''
  touched.value = false
}
defineExpose({ reset })

function onSubmit(): void {
  touched.value = true
  const selectedReason = reason.value
  if (
    warehouseError.value ||
    productError.value ||
    quantityError.value ||
    noteError.value ||
    !isReason(selectedReason)
  ) {
    return
  }
  const trimmedNote = note.value.trim()
  emit('submit', {
    warehouseId: warehouseId.value,
    productId: productId.value,
    quantity: Number(quantity.value.trim()),
    reason: selectedReason,
    // La nota es opcional: si está vacía no se envía
    ...(trimmedNote ? { note: trimmedNote } : {}),
  })
}
</script>

<template>
  <form class="form" novalidate @submit.prevent="onSubmit">
    <label>
      Bodega
      <select v-model="warehouseId" name="warehouseId" :disabled="saving">
        <option value="" disabled>Selecciona una bodega</option>
        <option v-for="w in warehouses" :key="w.id" :value="w.id">
          {{ w.code }} · {{ w.name }}{{ w.active ? '' : ' (inactiva)' }}
        </option>
      </select>
    </label>
    <p v-if="touched && warehouseError" class="field-error" role="alert">{{ warehouseError }}</p>

    <label>
      Producto
      <select v-model="productId" name="productId" :disabled="saving">
        <option value="" disabled>Selecciona un producto</option>
        <option v-for="p in products" :key="p.id" :value="p.id">{{ p.sku }} · {{ p.name }}</option>
      </select>
    </label>
    <p v-if="touched && productError" class="field-error" role="alert">{{ productError }}</p>

    <label>
      Cantidad (unidades)
      <input
        v-model="quantity"
        name="quantity"
        type="text"
        inputmode="numeric"
        :disabled="saving"
      />
    </label>
    <p v-if="touched && quantityError" class="field-error" role="alert">{{ quantityError }}</p>

    <label>
      Motivo
      <select v-model="reason" name="reason" :disabled="saving">
        <option value="" disabled>Selecciona un motivo</option>
        <option v-for="option in reasonOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>
    <p v-if="touched && reasonError" class="field-error" role="alert">{{ reasonError }}</p>

    <label>
      Nota (opcional)
      <textarea v-model="note" name="note" rows="2" :disabled="saving"></textarea>
    </label>
    <p v-if="touched && noteError" class="field-error" role="alert">{{ noteError }}</p>

    <p v-if="serverError" class="field-error" role="alert">{{ serverError }}</p>

    <div class="actions">
      <button type="submit" :disabled="saving">
        {{ saving ? 'Registrando…' : 'Registrar merma' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.form {
  display: grid;
  gap: 0.5rem;
  max-width: 24rem;
  margin: 1rem 0;
  padding: 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}
label {
  display: grid;
  gap: 0.25rem;
}
.field-error {
  margin: 0;
  color: #b91c1c;
}
.actions {
  display: flex;
  gap: 0.5rem;
}
</style>
