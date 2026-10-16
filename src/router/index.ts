import { createRouter, createWebHistory, type Router } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'
import HomeView from '@/views/HomeView.vue'
import PendingView from '@/views/PendingView.vue'
import WarehousesView from '@/views/WarehousesView.vue'
import NotFoundView from '@/views/NotFoundView.vue'

export const routes = [
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
