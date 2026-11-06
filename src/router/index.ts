import { createRouter, createWebHistory, type RouteRecordRaw, type Router } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'
import HomeView from '@/views/HomeView.vue'
import KardexView from '@/views/KardexView.vue'
import LoginView from '@/views/LoginView.vue'
import ProductsView from '@/views/ProductsView.vue'
import SessionsView from '@/views/SessionsView.vue'
import ReportsView from '@/views/ReportsView.vue'
import StockEntryView from '@/views/StockEntryView.vue'
import StockShrinkageView from '@/views/StockShrinkageView.vue'
import StockView from '@/views/StockView.vue'
import TransferDetailView from '@/views/TransferDetailView.vue'
import TransferNewView from '@/views/TransferNewView.vue'
import TransfersView from '@/views/TransfersView.vue'
import UsersView from '@/views/UsersView.vue'
import WarehousesView from '@/views/WarehousesView.vue'
import NotFoundView from '@/views/NotFoundView.vue'
import ForbiddenView from '@/views/ForbiddenView.vue'
import type { Permission } from '@/permissions'
import { installAuthGuard } from './guard'

declare module 'vue-router' {
  interface RouteMeta {
    /** Ruta accesible sin sesión (solo el login). Las demás exigen estar autenticado. */
    public?: boolean
    /** Permiso que exige la ruta; sin él se muestra la pantalla de "sin permiso". */
    permission?: Permission
  }
}

// Los nombres de ruta que usa el tiempo real para saber qué hay en pantalla: `stock`, `transfers`
// y `transfer-detail` (ver `screenFromRoute` en realtime.ts).
export const routes: RouteRecordRaw[] = [
  { path: '/login', component: LoginView, meta: { public: true } },
  {
    path: '/',
    component: MainLayout,
    children: [
      { path: '', component: HomeView },
      { path: 'bodegas', component: WarehousesView },
      { path: 'productos', component: ProductsView },
      { path: 'stock', name: 'stock', component: StockView },
      { path: 'stock/entrada', component: StockEntryView, meta: { permission: 'stock:entry' } },
      {
        path: 'stock/merma',
        component: StockShrinkageView,
        meta: { permission: 'stock:shrinkage' },
      },
      { path: 'kardex', component: KardexView, meta: { permission: 'reports:view' } },
      { path: 'reportes', component: ReportsView, meta: { permission: 'reports:view' } },
      { path: 'traspasos', name: 'transfers', component: TransfersView },
      {
        path: 'traspasos/nuevo',
        component: TransferNewView,
        meta: { permission: 'transfer:create' },
      },
      { path: 'traspasos/:id', name: 'transfer-detail', component: TransferDetailView },
      { path: 'usuarios', component: UsersView, meta: { permission: 'users:manage' } },
      { path: 'mi-cuenta', component: SessionsView },
      { path: 'sin-permiso', component: ForbiddenView },
    ],
  },
  { path: '/:pathMatch(.*)*', component: NotFoundView },
]

export const router: Router = createRouter({ history: createWebHistory(), routes })
installAuthGuard(router)
