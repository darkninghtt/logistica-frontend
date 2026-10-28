<script setup lang="ts">
import { computed, ref } from 'vue'

const MAX_REASON_LENGTH = 500

defineProps<{ saving: boolean }>()
const emit = defineEmits<{ submit: [reason: string] }>()

const reason = ref('')
const touched = ref(false)

const reasonError = computed(() => {
  const text = reason.value.trim()
  if (!text) return 'El motivo es obligatorio'
  if (text.length > MAX_REASON_LENGTH) return `Máximo ${MAX_REASON_LENGTH} caracteres`
  return null
})

function onSubmit(): void {
  touched.value = true
  if (reasonError.value) return
  emit('submit', reason.value.trim())
}
</script>

<template>
  <form class="resolve" novalidate @submit.prevent="onSubmit">
    <label>
      Motivo de la resolución
      <textarea v-model="reason" name="resolveReason" rows="2" :disabled="saving"></textarea>
    </label>
    <p v-if="touched && reasonError" class="field-error" role="alert">{{ reasonError }}</p>
    <button type="submit" :disabled="saving">
      {{ saving ? 'Procesando…' : 'Resolver discrepancia' }}
    </button>
  </form>
</template>

<style scoped>
.resolve {
  display: grid;
  gap: 0.5rem;
  max-width: 32rem;
  margin: 0.5rem 0 1rem;
}
label {
  display: grid;
  gap: 0.25rem;
}
.field-error {
  margin: 0;
  color: #b91c1c;
}
button {
  justify-self: start;
}
</style>
