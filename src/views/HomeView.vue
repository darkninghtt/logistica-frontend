<script setup lang="ts">
import DashboardPanel from '@/components/DashboardPanel.vue'
import { useAuthStore } from '@/stores/auth'

// El dashboard tiene datos de costo: lo ven quienes ven reportes (el OPERATOR, el inicio de siempre)
const auth = useAuthStore()
</script>

<template>
  <h1>Inicio</h1>
  <DashboardPanel v-if="auth.can('reports:view')" />
  <p v-else>Traspasos inter-bodegas, mermas y costo promedio ponderado.</p>
</template>
