<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Product } from '@/types/product'
import type { TransferInput, WarehouseRef } from '@/types/transfer'

const MAX_QUANTITY = 1_000_000_000
const MAX_NOTE_LENGTH = 500
const MAX_ITEMS = 100

const props = defineProps<{
  /** Bodegas asignadas a quien crea el borrador. */
  origins: WarehouseRef[]
  /** Todas las bodegas activas. */
  destinations: WarehouseRef[]
  products: Product[]
  saving: boolean
  /** Error devuelto por la API al crear (por ejemplo, un producto que ya no existe). */
  serverError: string | null
}>()
const emit = defineEmits<{ submit: [input: TransferInput]; cancel: [] }>()

interface Line {
  key: number
  productId: string
  quantity: string
}

let nextKey = 1
const originId = ref(props.origins.length === 1 ? (props.origins[0]?.id ?? '') : '')
const destinationId = ref('')
const note = ref('')
const lines = ref<Line[]>([{ key: nextKey++, productId: '', quantity: '' }])
const touched = ref(false)

// El destino no puede ser el origen: esa bodega no se ofrece
const destinationOptions = computed(() => props.destinations.filter((w) => w.id !== originId.value))

const originError = computed(() => (originId.value ? null : 'Elige la bodega de origen'))
const destinationError = computed(() => {
  if (!destinationId.value) return 'Elige la bodega de destino'
  if (destinationId.value === originId.value) return 'El destino debe ser distinto del origen'
  return null
})
const noteError = computed(() =>
  note.value.trim().length > MAX_NOTE_LENGTH
    ? `La nota no puede superar ${MAX_NOTE_LENGTH} caracteres`
    : null,
)

function lineError(line: Line): string | null {
  if (!line.productId) return 'Elige un producto'
  const quantity = line.quantity.trim()
  if (!quantity) return 'La cantidad es obligatoria'
  if (!/^\d+$/.test(quantity) || Number(quantity) < 1) {
    return 'La cantidad debe ser un entero mayor que 0'
  }
  if (Number(quantity) > MAX_QUANTITY) return `La cantidad no puede superar ${MAX_QUANTITY}`
  const repeated = lines.value.some((other) => other !== line && other.productId === line.productId)
  return repeated ? 'Ese producto ya está en el traspaso' : null
}

function addLine(): void {
  if (lines.value.length < MAX_ITEMS) {
    lines.value.push({ key: nextKey++, productId: '', quantity: '' })
  }
}

function removeLine(key: number): void {
  lines.value = lines.value.filter((line) => line.key !== key)
}

function onSubmit(): void {
  touched.value = true
  if (
    originError.value ||
    destinationError.value ||
    noteError.value ||
    lines.value.length === 0 ||
    lines.value.some((line) => lineError(line))
  ) {
    return
  }
  const trimmedNote = note.value.trim()
  emit('submit', {
    originWarehouseId: originId.value,
    destinationWarehouseId: destinationId.value,
    items: lines.value.map((line) => ({
      productId: line.productId,
      quantity: Number(line.quantity.trim()),
    })),
    // La nota es opcional: si está vacía no se envía
    ...(trimmedNote ? { note: trimmedNote } : {}),
  })
}
</script>

<template>
  <form class="form" novalidate @submit.prevent="onSubmit">
    <label>
      Bodega de origen
      <select v-model="originId" name="originWarehouseId" :disabled="saving">
        <option value="" disabled>Selecciona la bodega de origen</option>
        <option v-for="w in origins" :key="w.id" :value="w.id">{{ w.code }} · {{ w.name }}</option>
      </select>
    </label>
    <p v-if="touched && originError" class="field-error" role="alert">{{ originError }}</p>

    <label>
      Bodega de destino
      <select v-model="destinationId" name="destinationWarehouseId" :disabled="saving">
        <option value="" disabled>Selecciona la bodega de destino</option>
        <option v-for="w in destinationOptions" :key="w.id" :value="w.id">
          {{ w.code }} · {{ w.name }}
        </option>
      </select>
    </label>
    <p v-if="touched && destinationError" class="field-error" role="alert">
      {{ destinationError }}
    </p>

    <fieldset class="items">
      <legend>Productos</legend>
      <div v-for="(line, index) in lines" :key="line.key" class="line">
        <label>
          Producto
          <select v-model="line.productId" :name="`productId-${index}`" :disabled="saving">
            <option value="" disabled>Selecciona un producto</option>
            <option v-for="p in products" :key="p.id" :value="p.id">
              {{ p.sku }} · {{ p.name }}
            </option>
          </select>
        </label>
        <label>
          Cantidad
          <input
            v-model="line.quantity"
            :name="`quantity-${index}`"
            type="text"
            inputmode="numeric"
            :disabled="saving"
          />
        </label>
        <button
          type="button"
          :disabled="saving || lines.length === 1"
          :aria-label="`Quitar el producto ${index + 1}`"
          @click="removeLine(line.key)"
        >
          Quitar
        </button>
        <p v-if="touched && lineError(line)" class="field-error" role="alert">
          {{ lineError(line) }}
        </p>
      </div>
      <button type="button" :disabled="saving || lines.length >= MAX_ITEMS" @click="addLine">
        Agregar producto
      </button>
    </fieldset>

    <label>
      Nota (opcional)
      <textarea v-model="note" name="note" rows="2" :disabled="saving"></textarea>
    </label>
    <p v-if="touched && noteError" class="field-error" role="alert">{{ noteError }}</p>

    <p v-if="serverError" class="field-error" role="alert">{{ serverError }}</p>

    <div class="actions">
      <button type="submit" :disabled="saving">
        {{ saving ? 'Guardando…' : 'Crear borrador' }}
      </button>
      <button type="button" :disabled="saving" @click="emit('cancel')">Cancelar</button>
    </div>
  </form>
</template>

<style scoped>
.form {
  display: grid;
  gap: 0.5rem;
  max-width: 36rem;
  margin: 1rem 0;
  padding: 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}
label {
  display: grid;
  gap: 0.25rem;
}
.items {
  display: grid;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}
.line {
  display: grid;
  grid-template-columns: 1fr 8rem auto;
  gap: 0.5rem;
  align-items: end;
}
.line .field-error {
  grid-column: 1 / -1;
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
