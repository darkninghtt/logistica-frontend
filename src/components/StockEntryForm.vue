<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Product } from '@/types/product'
import type { StockEntryInput } from '@/types/stockEntry'
import type { Warehouse } from '@/types/warehouse'

const MAX_QUANTITY = 1_000_000_000
// Costo mayor que 0 con hasta 10 enteros y 4 decimales (lo que admite NUMERIC(14,4) de la API)
const COST_PATTERN = /^\d{1,10}(\.\d{1,4})?$/

defineProps<{
  warehouses: Warehouse[]
  products: Product[]
  saving: boolean
  /** Error devuelto por la API al registrar (por ejemplo, bodega inexistente). */
  serverError: string | null
}>()
const emit = defineEmits<{ submit: [input: StockEntryInput] }>()

const warehouseId = ref('')
const productId = ref('')
const quantity = ref('')
const unitCost = ref('')
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
const costError = computed(() => {
  const value = unitCost.value.trim()
  if (!value) return 'El costo unitario es obligatorio'
  if (!COST_PATTERN.test(value)) return 'El costo debe ser un número con hasta 4 decimales'
  if (Number(value) <= 0) return 'El costo debe ser mayor que 0'
  return null
})

/** Limpia cantidad y costo (se conservan bodega y producto para cargar varias entradas seguidas). */
function reset(): void {
  quantity.value = ''
  unitCost.value = ''
  touched.value = false
}
defineExpose({ reset })

function onSubmit(): void {
  touched.value = true
  if (warehouseError.value || productError.value || quantityError.value || costError.value) return
  emit('submit', {
    warehouseId: warehouseId.value,
    productId: productId.value,
    quantity: Number(quantity.value.trim()),
    unitCost: unitCost.value.trim(),
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
      Costo unitario
      <input
        v-model="unitCost"
        name="unitCost"
        type="text"
        inputmode="decimal"
        :disabled="saving"
      />
    </label>
    <p v-if="touched && costError" class="field-error" role="alert">{{ costError }}</p>

    <p v-if="serverError" class="field-error" role="alert">{{ serverError }}</p>

    <div class="actions">
      <button type="submit" :disabled="saving">
        {{ saving ? 'Registrando…' : 'Registrar entrada' }}
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
