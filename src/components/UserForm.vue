<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ROLE_LABELS, ROLES, roleUsesWarehouses } from '@/permissions'
import type { Role } from '@/types/auth'
import type { ManagedUser, UserFormValue } from '@/types/user'
import type { Warehouse } from '@/types/warehouse'

const props = defineProps<{
  /** Usuario a editar; sin valor, el formulario crea uno nuevo. */
  user?: ManagedUser
  /** Bodegas que se pueden asignar. */
  warehouses: Warehouse[]
  saving: boolean
  /** Error devuelto por la API al guardar (por ejemplo, correo repetido). */
  serverError: string | null
  /** Es el propio ADMIN: no puede quitarse el rol ni desactivarse (se quedaría sin acceso). */
  isSelf?: boolean
}>()
const emit = defineEmits<{
  submit: [value: UserFormValue]
  cancel: []
}>()

const MIN_PASSWORD = 12

const name = ref('')
const email = ref('')
const role = ref<Role>('OPERATOR')
const password = ref('')
const active = ref(true)
const warehouseIds = ref<string[]>([])
const touched = ref(false)

watch(
  () => props.user,
  (user) => {
    name.value = user?.name ?? ''
    email.value = user?.email ?? ''
    role.value = user?.role ?? 'OPERATOR'
    password.value = ''
    active.value = user?.active ?? true
    warehouseIds.value = [...(user?.warehouseIds ?? [])]
    touched.value = false
  },
  { immediate: true },
)

const usesWarehouses = computed(() => roleUsesWarehouses(role.value))
// Las activas, más las inactivas que ya tenía asignadas (para poder quitárselas)
const warehouseOptions = computed(() =>
  props.warehouses.filter((w) => w.active || warehouseIds.value.includes(w.id)),
)

const nameError = computed(() => {
  const value = name.value.trim()
  if (!value) return 'El nombre es obligatorio'
  if (value.length > 100) return 'El nombre admite máximo 100 caracteres'
  return null
})
const emailError = computed(() =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()) ? null : 'Escribe un correo válido',
)
const passwordError = computed(() => {
  // Al editar, vacía = no se cambia
  if (props.user && password.value === '') return null
  if (password.value.length < MIN_PASSWORD) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`
  }
  if (password.value.length > 128) return 'La contraseña admite máximo 128 caracteres'
  return null
})

function isRole(value: string): value is Role {
  return ROLES.some((r) => r === value)
}

function onRoleChange(event: Event): void {
  if (event.target instanceof HTMLSelectElement && isRole(event.target.value)) {
    role.value = event.target.value
  }
}

function onSubmit(): void {
  touched.value = true
  if (nameError.value || emailError.value || passwordError.value) return
  emit('submit', {
    name: name.value.trim(),
    email: email.value.trim(),
    role: role.value,
    password: password.value,
    active: active.value,
    warehouseIds: usesWarehouses.value ? [...warehouseIds.value] : [],
  })
}
</script>

<template>
  <form class="form" novalidate @submit.prevent="onSubmit">
    <h2>{{ user ? 'Editar usuario' : 'Nuevo usuario' }}</h2>

    <label>
      Nombre
      <input v-model="name" name="name" type="text" :disabled="saving" />
    </label>
    <p v-if="touched && nameError" class="field-error" role="alert">{{ nameError }}</p>

    <label>
      Correo
      <input v-model="email" name="email" type="email" autocomplete="off" :disabled="saving" />
    </label>
    <p v-if="touched && emailError" class="field-error" role="alert">{{ emailError }}</p>

    <label>
      Rol
      <select name="role" :value="role" :disabled="saving || isSelf" @change="onRoleChange">
        <option v-for="option in ROLES" :key="option" :value="option">
          {{ ROLE_LABELS[option] }}
        </option>
      </select>
    </label>

    <label>
      {{ user ? 'Nueva contraseña (opcional)' : 'Contraseña inicial' }}
      <input
        v-model="password"
        name="password"
        type="password"
        autocomplete="new-password"
        :disabled="saving"
      />
    </label>
    <p v-if="user" class="hint">Déjala vacía para no cambiarla.</p>
    <p v-if="touched && passwordError" class="field-error" role="alert">{{ passwordError }}</p>

    <label class="check">
      <input v-model="active" name="active" type="checkbox" :disabled="saving || isSelf" />
      Activo (puede iniciar sesión)
    </label>

    <fieldset v-if="usesWarehouses" :disabled="saving">
      <legend>Bodegas asignadas</legend>
      <p v-if="warehouseOptions.length === 0" class="hint">
        No hay bodegas activas. Crea una en Bodegas.
      </p>
      <label v-for="warehouse in warehouseOptions" :key="warehouse.id" class="check">
        <input v-model="warehouseIds" type="checkbox" name="warehouseIds" :value="warehouse.id" />
        {{ warehouse.code }} · {{ warehouse.name }}
        <template v-if="!warehouse.active">(inactiva)</template>
      </label>
      <p v-if="warehouseIds.length === 0 && warehouseOptions.length > 0" class="hint">
        Sin bodegas asignadas no podrá operar en ninguna.
      </p>
    </fieldset>
    <p v-else class="hint" data-test="global-scope">
      {{ ROLE_LABELS[role] }}: ve todas las bodegas, no se le asignan.
    </p>

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
  max-width: 28rem;
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
fieldset {
  display: grid;
  gap: 0.25rem;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}
.hint {
  margin: 0;
  color: #6b7280;
  font-size: 0.875rem;
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
