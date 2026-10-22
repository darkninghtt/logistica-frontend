import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import type { Role } from '@/types/auth'

/** Pinia con una sesión ya iniciada con ese rol, para montar vistas que dependen del rol. */
export function piniaSignedInAs(role: Role): Pinia {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore(pinia).user = { id: `u-${role}`, name: 'Usuario de prueba', email: 'u@b.co', role }
  return pinia
}
