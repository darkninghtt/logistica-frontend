import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import * as api from '@/api/users'
import { listWarehouses } from '@/api/warehouses'
import { toApiError } from '@/api/http'
import { useTtlCache } from '@/composables/useTtlCache'
import { roleUsesWarehouses } from '@/permissions'
import type { LoadStatus } from '@/types/api'
import type { ManagedUser, UserFormValue, UserUpdateInput } from '@/types/user'
import type { Warehouse } from '@/types/warehouse'

/** Máximo que admite la API por página: la selección de bodegas muestra hasta tantas. */
const OPTIONS_PAGE_SIZE = 100

/**
 * Resultado de guardar. Si el usuario se guardó pero falló la asignación de bodegas, `user` trae el
 * usuario ya creado: la vista pasa a editarlo para que reintentar no lo cree dos veces.
 */
export type UserSaveResult = { ok: true } | { ok: false; user: ManagedUser | null }

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id))
}

/**
 * Store del dominio "usuarios" (solo ADMIN): la página actual normalizada (`byId` + `ids`), crear y
 * editar (con sus bodegas), activar o desactivar, y las bodegas que se pueden asignar.
 */
export const useUsersStore = defineStore('users', () => {
  const byId = ref<Record<string, ManagedUser>>({})
  const ids = ref<string[]>([])
  const page = ref(1)
  const pageSize = ref(10)
  const total = ref(0)
  const status = ref<LoadStatus>('idle')
  const error = ref<string | null>(null)
  const cache = useTtlCache()
  let listRequest = 0

  const saving = ref(false)
  const saveError = ref<string | null>(null)
  /** Error de activar o desactivar desde la lista (el formulario tiene el suyo: `saveError`). */
  const actionError = ref<string | null>(null)

  const warehouses = ref<Warehouse[]>([])
  const optionsStatus = ref<LoadStatus>('idle')
  const optionsError = ref<string | null>(null)
  const optionsCache = useTtlCache()

  const items = computed<ManagedUser[]>(() =>
    ids.value.flatMap((id) => {
      const user = byId.value[id]
      return user ? [user] : []
    }),
  )
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
  /** Nombre de cada bodega por id, para mostrar las asignadas en la lista. */
  const warehouseNames = computed<Record<string, string>>(() =>
    Object.fromEntries(warehouses.value.map((w) => [w.id, `${w.code} · ${w.name}`])),
  )

  /** Carga una página. Si es la misma y sigue vigente (TTL) no la vuelve a pedir, salvo con `force`. */
  async function fetchPage(
    target: number = page.value,
    { force = false }: { force?: boolean } = {},
  ): Promise<void> {
    if (!force && cache.isFresh(String(target))) return
    const request = ++listRequest
    status.value = 'loading'
    error.value = null
    try {
      const result = await api.listUsers(target, pageSize.value)
      if (request !== listRequest) return
      byId.value = { ...byId.value, ...Object.fromEntries(result.data.map((u) => [u.id, u])) }
      ids.value = result.data.map((u) => u.id)
      page.value = result.page
      total.value = result.total
      cache.markFetched(String(result.page))
      status.value = 'success'
    } catch (err) {
      if (request !== listRequest) return
      cache.invalidate()
      error.value = toApiError(err).message
      status.value = 'error'
    }
  }

  /** Bodegas que se pueden asignar (el ADMIN las ve todas). Con caché, salvo con `force`. */
  async function loadWarehouses({ force = false }: { force?: boolean } = {}): Promise<void> {
    if (!force && optionsCache.isFresh()) return
    optionsStatus.value = 'loading'
    optionsError.value = null
    try {
      warehouses.value = (await listWarehouses(1, OPTIONS_PAGE_SIZE)).data
      optionsCache.markFetched()
      optionsStatus.value = 'success'
    } catch (err) {
      optionsCache.invalidate()
      optionsError.value = toApiError(err).message
      optionsStatus.value = 'error'
    }
  }

  /**
   * Crea o edita un usuario y luego, si cambiaron, sus bodegas (son dos llamadas a la API). El ADMIN
   * y el AUDITOR ven todas las bodegas, así que a ellos se les deja la lista vacía.
   */
  async function save(value: UserFormValue, existing?: ManagedUser): Promise<UserSaveResult> {
    if (saving.value) return { ok: false, user: null }
    saving.value = true
    saveError.value = null
    const warehouseIds = roleUsesWarehouses(value.role) ? value.warehouseIds : []
    try {
      let user: ManagedUser
      try {
        if (existing) {
          const input: UserUpdateInput = {
            email: value.email,
            name: value.name,
            role: value.role,
            active: value.active,
          }
          // Contraseña vacía al editar = se deja la que tenía
          if (value.password) input.password = value.password
          user = await api.updateUser(existing.id, input)
        } else {
          user = await api.createUser({
            email: value.email,
            name: value.name,
            role: value.role,
            password: value.password,
            active: value.active,
          })
        }
      } catch (err) {
        saveError.value = toApiError(err).message
        return { ok: false, user: null }
      }

      if (!sameIds(user.warehouseIds, warehouseIds)) {
        try {
          const assigned = await api.setUserWarehouses(user.id, warehouseIds)
          user = { ...user, warehouseIds: assigned.warehouseIds }
        } catch (err) {
          saveError.value = `El usuario se guardó, pero no se pudieron asignar las bodegas: ${
            toApiError(err).message
          }`
          await refresh()
          return { ok: false, user }
        }
      }
      await refresh()
      return { ok: true }
    } finally {
      saving.value = false
    }
  }

  /** Activa o desactiva desde la lista. Un usuario desactivado ya no puede iniciar sesión. */
  async function setActive(user: ManagedUser, active: boolean): Promise<boolean> {
    if (saving.value) return false
    saving.value = true
    actionError.value = null
    try {
      await api.updateUser(user.id, {
        email: user.email,
        name: user.name,
        role: user.role,
        active,
      })
    } catch (err) {
      actionError.value = toApiError(err).message
      return false
    } finally {
      saving.value = false
    }
    await refresh()
    return true
  }

  /** Vuelve a pedir la página actual después de guardar. */
  async function refresh(): Promise<void> {
    cache.invalidate()
    await fetchPage(page.value, { force: true })
  }

  /** Descarta las respuestas en vuelo al cerrar la sesión (ver el plugin `resetOnSessionEnd`). */
  function cancelPending(): void {
    listRequest++
  }

  function clearSaveError(): void {
    saveError.value = null
  }

  return {
    byId,
    ids,
    page,
    pageSize,
    total,
    status,
    error,
    saving,
    saveError,
    actionError,
    warehouses,
    optionsStatus,
    optionsError,
    lastFetchedAt: cache.lastFetchedAt,
    items,
    totalPages,
    warehouseNames,
    fetchPage,
    loadWarehouses,
    save,
    setActive,
    cancelPending,
    clearSaveError,
  }
})
