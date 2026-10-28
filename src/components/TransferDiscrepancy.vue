<script setup lang="ts">
import { computed } from 'vue'
import { itemDifferences } from '@/transfers'
import type { TransferItem } from '@/types/transfer'

const props = defineProps<{
  items: TransferItem[]
  /** true cuando la discrepancia ya se resolvió (cambia el texto, no los datos). */
  resolved: boolean
}>()

// Solo los ítems que no coinciden; los que coinciden ya entraron completos al destino
const differences = computed(() => itemDifferences(props.items).filter((d) => d.kind !== 'match'))

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}
</script>

<template>
  <section class="discrepancy" :data-resolved="resolved" data-test="discrepancy">
    <h2>{{ resolved ? 'Discrepancia resuelta' : 'Discrepancia pendiente' }}</h2>
    <p v-if="resolved">
      Se registró al costo congelado del despacho: cada faltante como merma en tránsito y cada
      sobrante como ajuste de entrada al destino.
    </p>
    <p v-else>
      Al destino ya entró lo que coincide con lo enviado. La diferencia está retenida: no cambia el
      stock ni el costo promedio hasta resolverla.
    </p>
    <table>
      <thead>
        <tr>
          <th>Producto</th>
          <th class="num">Enviado</th>
          <th class="num">Recibido</th>
          <th class="num">Diferencia</th>
          <th>{{ resolved ? 'Se registró como' : 'Al resolver' }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="d in differences" :key="d.productId">
          <td>{{ d.productSku }} · {{ d.productName }}</td>
          <td class="num">{{ d.sent }}</td>
          <td class="num">{{ d.received }}</td>
          <td class="num">{{ signed(d.difference) }}</td>
          <td>
            {{
              d.kind === 'shortage'
                ? `Faltante: merma en tránsito de ${-d.difference} u`
                : `Sobrante: ajuste de entrada de ${d.difference} u`
            }}
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.discrepancy {
  margin: 1rem 0;
  padding: 1rem;
  border: 1px solid #fca5a5;
  border-radius: 6px;
  background: #fef2f2;
}
.discrepancy[data-resolved='true'] {
  border-color: #86efac;
  background: #f0fdf4;
}
.discrepancy h2 {
  margin-top: 0;
  font-size: 1.1rem;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: 0.5rem;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}
.num {
  text-align: right;
}
</style>
