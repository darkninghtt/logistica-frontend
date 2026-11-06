<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PasswordChangeInput } from '@/types/session'

defineProps<{
  saving: boolean
  /** Error devuelto por la API (por ejemplo, contraseña actual incorrecta). */
  serverError: string | null
  /** Se cambió con éxito: se muestra la confirmación. */
  done: boolean
}>()
const emit = defineEmits<{ submit: [input: PasswordChangeInput] }>()

const MIN_PASSWORD = 12

const currentPassword = ref('')
const newPassword = ref('')
const confirmation = ref('')
const touched = ref(false)

const currentError = computed(() => (currentPassword.value ? null : 'Escribe tu contraseña actual'))
const newError = computed(() => {
  if (newPassword.value.length < MIN_PASSWORD) {
    return `La nueva contraseña debe tener al menos ${MIN_PASSWORD} caracteres`
  }
  if (newPassword.value.length > 128) return 'La nueva contraseña admite máximo 128 caracteres'
  if (newPassword.value === currentPassword.value) return 'La nueva contraseña debe ser distinta'
  return null
})
const confirmationError = computed(() =>
  confirmation.value === newPassword.value ? null : 'Las contraseñas no coinciden',
)

function onSubmit(): void {
  touched.value = true
  if (currentError.value || newError.value || confirmationError.value) return
  emit('submit', { currentPassword: currentPassword.value, newPassword: newPassword.value })
}

/** La vista lo llama tras cambiarla con éxito, para no dejar las contraseñas escritas. */
function reset(): void {
  currentPassword.value = ''
  newPassword.value = ''
  confirmation.value = ''
  touched.value = false
}

defineExpose({ reset })
</script>

<template>
  <form class="form" novalidate @submit.prevent="onSubmit">
    <h2>Cambiar contraseña</h2>

    <label>
      Contraseña actual
      <input
        v-model="currentPassword"
        name="currentPassword"
        type="password"
        autocomplete="current-password"
        :disabled="saving"
      />
    </label>
    <p v-if="touched && currentError" class="field-error" role="alert">{{ currentError }}</p>

    <label>
      Nueva contraseña
      <input
        v-model="newPassword"
        name="newPassword"
        type="password"
        autocomplete="new-password"
        :disabled="saving"
      />
    </label>
    <p v-if="touched && newError" class="field-error" role="alert">{{ newError }}</p>

    <label>
      Repite la nueva contraseña
      <input
        v-model="confirmation"
        name="confirmation"
        type="password"
        autocomplete="new-password"
        :disabled="saving"
      />
    </label>
    <p v-if="touched && confirmationError" class="field-error" role="alert">
      {{ confirmationError }}
    </p>

    <p v-if="serverError" class="field-error" role="alert">{{ serverError }}</p>
    <p v-else-if="done" class="ok" role="status" data-test="password-done">
      Contraseña cambiada. Se cerraron tus demás sesiones.
    </p>

    <div>
      <button type="submit" :disabled="saving">
        {{ saving ? 'Guardando…' : 'Cambiar contraseña' }}
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
  border: 1px solid var(--border-strong);
  border-radius: 6px;
}
label {
  display: grid;
  gap: 0.25rem;
}
.field-error {
  margin: 0;
  color: var(--danger);
}
.ok {
  margin: 0;
  color: var(--success);
}
</style>
