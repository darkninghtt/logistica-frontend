import type { RouteLocationNormalized, RouteLocationRaw, Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

/**
 * Decide si se permite entrar a una ruta. Devuelve `true` o a dónde redirigir:
 * - ruta protegida sin sesión → /login con la ruta de retorno en `redirect`;
 * - /login con sesión iniciada → inicio.
 * Es solo comodidad de la interfaz: la seguridad real la aplica el backend.
 */
export function resolveAccess(to: RouteLocationNormalized): true | RouteLocationRaw {
  const auth = useAuthStore()
  if (to.meta.public) return auth.isAuthenticated && to.path === '/login' ? '/' : true
  if (!auth.isAuthenticated) return { path: '/login', query: { redirect: to.fullPath } }
  return true
}

export function installAuthGuard(router: Router): void {
  router.beforeEach((to) => resolveAccess(to))
}
