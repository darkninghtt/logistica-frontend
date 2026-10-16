import { createRouter, createWebHistory, type Router } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'
import HomeView from '@/views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'
import PendingView from '@/views/PendingView.vue'
import WarehousesView from '@/views/WarehousesView.vue'
import NotFoundView from '@/views/NotFoundView.vue'
import { installAuthGuard } from './guard'

declare module 'vue-router' {
  interface RouteMeta {
    /** Ruta accesible sin sesión (solo el login). Las demás exigen estar autenticado. */
    public?: boolean
  }
}

export const routes = [
  { path: '/login', component: LoginView, meta: { public: true } },
  {
    path: '/',
    component: MainLayout,
    children: [
      { path: '', component: HomeView },
      { path: 'bodegas', component: WarehousesView },
      { path: 'productos', component: PendingView, props: { title: 'Productos' } },
      { path: 'stock', component: PendingView, props: { title: 'Stock' } },
    ],
  },
  { path: '/:pathMatch(.*)*', component: NotFoundView },
]

export const router: Router = createRouter({ history: createWebHistory(), routes })
installAuthGuard(router)
