import { createRouter, createWebHistory, type RouteRecordRaw, type Router } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'
import HomeView from '@/views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'
import ProductsView from '@/views/ProductsView.vue'
import StockEntryView from '@/views/StockEntryView.vue'
import StockShrinkageView from '@/views/StockShrinkageView.vue'
import StockView from '@/views/StockView.vue'
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

export const routes: RouteRecordRaw[] = [
  { path: '/login', component: LoginView, meta: { public: true } },
  {
    path: '/',
    component: MainLayout,
    children: [
      { path: '', component: HomeView },
      { path: 'bodegas', component: WarehousesView },
      { path: 'productos', component: ProductsView },
      { path: 'stock', component: StockView },
      { path: 'stock/entrada', component: StockEntryView, meta: { permission: 'stock:entry' } },
      {
        path: 'stock/merma',
        component: StockShrinkageView,
        meta: { permission: 'stock:shrinkage' },
      },
      { path: 'sin-permiso', component: ForbiddenView },
    ],
  },
  { path: '/:pathMatch(.*)*', component: NotFoundView },
]

export const router: Router = createRouter({ history: createWebHistory(), routes })
installAuthGuard(router)
