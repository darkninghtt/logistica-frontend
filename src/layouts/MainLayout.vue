<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'

const links = [
  { to: '/', label: 'Inicio' },
  { to: '/bodegas', label: 'Bodegas' },
  { to: '/productos', label: 'Productos' },
  { to: '/stock', label: 'Stock' },
]
</script>

<template>
  <div class="layout">
    <header class="topbar">
      <strong>Logística y Trazabilidad de Stock</strong>
      <nav aria-label="Principal">
        <RouterLink v-for="link in links" :key="link.to" :to="link.to">{{ link.label }}</RouterLink>
      </nav>
    </header>
    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  font-family: system-ui, sans-serif;
}
.topbar {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 0.75rem 1.5rem;
  background: #1f2937;
  color: #fff;
}
nav {
  display: flex;
  gap: 1rem;
}
nav a {
  color: #d1d5db;
  text-decoration: none;
}
nav a.router-link-exact-active {
  color: #fff;
  font-weight: 600;
}
.content {
  padding: 1.5rem;
}
</style>
