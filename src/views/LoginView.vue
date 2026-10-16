<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const touched = ref(false)

const emailError = computed(() => {
  const value = email.value.trim()
  if (!value) return 'El correo es obligatorio'
  if (!/^\S+@\S+\.\S+$/.test(value)) return 'El correo no es válido'
  return null
})
const passwordError = computed(() => (password.value ? null : 'La contraseña es obligatoria'))

/** Solo se acepta un retorno interno ("/algo"), nunca una URL externa. */
function returnPath(): string {
  const target = route.query.redirect
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//')
    ? target
    : '/'
}

async function onSubmit(): Promise<void> {
  touched.value = true
  if (emailError.value || passwordError.value) return
  const ok = await auth.login({ email: email.value.trim(), password: password.value })
  if (ok) await router.replace(returnPath())
}
</script>

<template>
  <main class="login">
    <form class="card" novalidate @submit.prevent="onSubmit">
      <h1>Iniciar sesión</h1>

      <label>
        Correo
        <input v-model="email" type="email" autocomplete="username" />
        <small v-if="touched && emailError" class="field-error">{{ emailError }}</small>
      </label>

      <label>
        Contraseña
        <input v-model="password" type="password" autocomplete="current-password" />
        <small v-if="touched && passwordError" class="field-error">{{ passwordError }}</small>
      </label>

      <p v-if="auth.error" role="alert" class="server-error">{{ auth.error }}</p>

      <button type="submit" :disabled="auth.status === 'loading'">
        {{ auth.status === 'loading' ? 'Entrando…' : 'Entrar' }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.login {
  min-height: 100vh;
  display: grid;
  place-items: center;
  font-family: system-ui, sans-serif;
  background: #f3f4f6;
}
.card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: min(22rem, 90vw);
  padding: 1.5rem;
  background: #fff;
  border-radius: 0.5rem;
  box-shadow: 0 1px 4px rgb(0 0 0 / 15%);
}
h1 {
  margin: 0;
  font-size: 1.25rem;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
input {
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
}
button {
  padding: 0.6rem;
  border: 0;
  border-radius: 0.25rem;
  background: #1f2937;
  color: #fff;
  cursor: pointer;
}
button:disabled {
  opacity: 0.6;
  cursor: wait;
}
.field-error,
.server-error {
  color: #b91c1c;
  margin: 0;
}
</style>
