<script setup lang="ts">
import { computed } from 'vue'
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js'
import { Bar, Doughnut } from 'vue-chartjs'
import type { ChartSeries } from '@/dashboard'
import { formatMoney } from '@/format'

// Solo las piezas de Chart.js que se usan (así el paquete pesa menos)
ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Legend, Tooltip)

/** Un color de la hoja de estilos global (cambia con el modo oscuro); el valor por defecto, si no hay. */
function themeColor(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}
// Textos y líneas de los gráficos con los colores del tema, para que se lean también en modo oscuro
ChartJS.defaults.color = themeColor('--muted', '#4b5563')
ChartJS.defaults.borderColor = themeColor('--border', '#e5e7eb')
// Los números de los ejes con separadores en español ("6.000.000", no "6,000,000")
ChartJS.defaults.locale = 'es-CO'

const props = defineProps<{
  inventory: ChartSeries
  transfers: ChartSeries
}>()

const STATUS_COLORS = ['#9ca3af', '#3b82f6', '#22c55e', '#f59e0b', '#14b8a6', '#ef4444']

const inventoryData = computed(() => ({
  labels: props.inventory.labels,
  datasets: [
    { label: 'Valor del inventario', data: props.inventory.values, backgroundColor: '#3b82f6' },
  ],
}))

const transfersData = computed(() => ({
  labels: props.transfers.labels,
  datasets: [{ data: props.transfers.values, backgroundColor: STATUS_COLORS }],
}))

const inventoryOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { callbacks: { label: (item: { raw: unknown }) => formatMoney(String(item.raw)) } },
  },
}
const transfersOptions = { responsive: true, maintainAspectRatio: false }
</script>

<template>
  <div class="charts">
    <figure>
      <figcaption>Valor del inventario por bodega</figcaption>
      <div class="canvas"><Bar :data="inventoryData" :options="inventoryOptions" /></div>
    </figure>
    <figure>
      <figcaption>Traspasos por estado</figcaption>
      <div class="canvas"><Doughnut :data="transfersData" :options="transfersOptions" /></div>
    </figure>
  </div>
</template>

<style scoped>
.charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: 1rem;
  margin: 1rem 0;
}
figure {
  margin: 0;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 6px;
}
figcaption {
  font-weight: 600;
  margin-bottom: 0.5rem;
}
.canvas {
  position: relative;
  height: 16rem;
}
</style>
