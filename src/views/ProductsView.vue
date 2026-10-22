<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ProductForm from '@/components/ProductForm.vue'
import { useAuthStore } from '@/stores/auth'
import { useProductsStore } from '@/stores/products'
import type { Product, ProductInput } from '@/types/product'

const store = useProductsStore()
// Solo el ADMIN crea y edita; el resto consulta
const canWrite = useAuthStore().can('catalog:write')

// Estado de la vista: qué formulario está abierto. `null` = cerrado; `'new'` = crear.
const editing = ref<Product | 'new' | null>(null)

onMounted(() => store.fetchPage())

async function onSubmit(input: ProductInput): Promise<void> {
  const current = editing.value
  const id = current && current !== 'new' ? current.id : undefined
  if (await store.save(input, id)) editing.value = null
}

function openForm(target: Product | 'new'): void {
  store.clearSaveError()
  editing.value = target
}
</script>

<template>
  <section>
    <div class="header">
      <h1>Productos</h1>
      <button v-if="canWrite" type="button" @click="openForm('new')">Nuevo producto</button>
    </div>

    <ProductForm
      v-if="canWrite && editing"
      :product="editing === 'new' ? undefined : editing"
      :saving="store.saving"
      :server-error="store.saveError"
      @submit="onSubmit"
      @cancel="editing = null"
    />

    <p v-if="store.status === 'loading' || store.status === 'idle'">Cargando productos…</p>

    <div v-else-if="store.status === 'error'" role="alert">
      <p>No se pudieron cargar los productos: {{ store.error }}</p>
      <button type="button" @click="store.fetchPage()">Reintentar</button>
    </div>

    <p v-else-if="store.items.length === 0" data-test="empty">
      {{ canWrite ? 'Todavía no hay productos. Crea el primero.' : 'Todavía no hay productos.' }}
    </p>

    <template v-else>
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>Nombre</th>
            <th>Unidad</th>
            <th v-if="canWrite">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="product in store.items" :key="product.id">
            <td>{{ product.sku }}</td>
            <td>{{ product.name }}</td>
            <td>{{ product.unit }}</td>
            <td v-if="canWrite" class="row-actions">
              <button type="button" :disabled="store.saving" @click="openForm(product)">
                Editar
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <nav class="pager" aria-label="Paginación">
        <button type="button" :disabled="store.page <= 1" @click="store.fetchPage(store.page - 1)">
          Anterior
        </button>
        <span>Página {{ store.page }} de {{ store.totalPages }} ({{ store.total }} productos)</span>
        <button
          type="button"
          :disabled="store.page >= store.totalPages"
          @click="store.fetchPage(store.page + 1)"
        >
          Siguiente
        </button>
      </nav>
    </template>
  </section>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
.row-actions {
  display: flex;
  gap: 0.5rem;
}
.pager {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
}
</style>
