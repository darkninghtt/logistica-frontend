<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()
const from = typeof route.query.from === 'string' ? route.query.from : null
</script>

<template>
  <section role="alert" data-test="forbidden">
    <h1>No tienes permiso para ver esta página</h1>
    <p>
      Tu rol no incluye esta acción<span v-if="from">
        (<code>{{ from }}</code
        >)</span
      >. Si crees que es un error, pide acceso a un administrador.
    </p>
    <RouterLink to="/">Volver al inicio</RouterLink>
  </section>
</template>
