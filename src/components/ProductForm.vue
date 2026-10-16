<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Product, ProductInput } from '@/types/product'

const props = defineProps<{
  /** Producto a editar; sin valor, el formulario crea uno nuevo. */
  product?: Product
  saving: boolean
  /** Error devuelto por la API al guardar (por ejemplo, SKU repetido). */
  serverError: string | null
}>()
const emit = defineEmits<{
  submit: [input: ProductInput]
  cancel: []
}>()

const sku = ref('')
const name = ref('')
const unit = ref('')
const touched = ref(false)

watch(
  () => props.product,
  (product) => {
    sku.value = product?.sku ?? ''
    name.value = product?.name ?? ''
    unit.value = product?.unit ?? ''
    touched.value = false
  },
  { immediate: true },
)

const skuError = computed(() => {
  const value = sku.value.trim()
  if (!value) return 'El SKU es obligatorio'
  if (value.length > 40) return 'El SKU admite máximo 40 caracteres'
  return null
})
const nameError = computed(() => {
  const value = name.value.trim()
  if (!value) return 'El nombre es obligatorio'
  if (value.length > 100) return 'El nombre admite máximo 100 caracteres'
  return null
})
const unitError = computed(() => {
  const value = unit.value.trim()
  if (!value) return 'La unidad es obligatoria'
  if (value.length > 20) return 'La unidad admite máximo 20 caracteres'
  return null
})

function onSubmit(): void {
  touched.value = true
  if (skuError.value || nameError.value || unitError.value) return
  emit('submit', { sku: sku.value.trim(), name: name.value.trim(), unit: unit.value.trim() })
}
</script>

<template>
  <form class="form" novalidate @submit.prevent="onSubmit">
    <h2>{{ product ? 'Editar producto' : 'Nuevo producto' }}</h2>

    <label>
      SKU
      <input v-model="sku" name="sku" type="text" :disabled="saving" />
    </label>
    <p v-if="touched && skuError" class="field-error" role="alert">{{ skuError }}</p>

    <label>
      Nombre
      <input v-model="name" name="name" type="text" :disabled="saving" />
    </label>
    <p v-if="touched && nameError" class="field-error" role="alert">{{ nameError }}</p>

    <label>
      Unidad (por ejemplo: un, kg, caja)
      <input v-model="unit" name="unit" type="text" :disabled="saving" />
    </label>
    <p v-if="touched && unitError" class="field-error" role="alert">{{ unitError }}</p>

    <p v-if="serverError" class="field-error" role="alert">{{ serverError }}</p>

    <div class="actions">
      <button type="submit" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar' }}</button>
      <button type="button" :disabled="saving" @click="emit('cancel')">Cancelar</button>
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
