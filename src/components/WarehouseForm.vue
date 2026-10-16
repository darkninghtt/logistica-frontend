<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Warehouse, WarehouseInput } from '@/types/warehouse'

const props = defineProps<{
  /** Bodega a editar; sin valor, el formulario crea una nueva. */
  warehouse?: Warehouse
  saving: boolean
  /** Error devuelto por la API al guardar (por ejemplo, código repetido). */
  serverError: string | null
}>()
const emit = defineEmits<{
  submit: [input: WarehouseInput]
  cancel: []
}>()

const code = ref('')
const name = ref('')
const active = ref(true)
const touched = ref(false)

watch(
  () => props.warehouse,
  (warehouse) => {
    code.value = warehouse?.code ?? ''
    name.value = warehouse?.name ?? ''
    active.value = warehouse?.active ?? true
    touched.value = false
  },
  { immediate: true },
)

const codeError = computed(() => {
  const value = code.value.trim()
  if (!value) return 'El código es obligatorio'
  if (value.length > 20) return 'El código admite máximo 20 caracteres'
  return null
})
const nameError = computed(() => {
  const value = name.value.trim()
  if (!value) return 'El nombre es obligatorio'
  if (value.length > 100) return 'El nombre admite máximo 100 caracteres'
  return null
})

function onSubmit(): void {
  touched.value = true
  if (codeError.value || nameError.value) return
  emit('submit', { code: code.value.trim(), name: name.value.trim(), active: active.value })
}
</script>

<template>
  <form class="form" novalidate @submit.prevent="onSubmit">
    <h2>{{ warehouse ? 'Editar bodega' : 'Nueva bodega' }}</h2>

    <label>
      Código
      <input v-model="code" name="code" type="text" :disabled="saving" />
    </label>
    <p v-if="touched && codeError" class="field-error" role="alert">{{ codeError }}</p>

    <label>
      Nombre
      <input v-model="name" name="name" type="text" :disabled="saving" />
    </label>
    <p v-if="touched && nameError" class="field-error" role="alert">{{ nameError }}</p>

    <label class="check">
      <input v-model="active" name="active" type="checkbox" :disabled="saving" />
      Activa
    </label>

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
.check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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
