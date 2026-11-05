import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import * as api from '@/api/users'
import * as warehousesApi from '@/api/warehouses'
import { ApiError } from '@/api/http'
import { CACHE_TTL_MS } from '@/composables/useTtlCache'
import { useUsersStore } from './users'
import type { ManagedUser, UserFormValue } from '@/types/user'

vi.mock('@/api/users')
vi.mock('@/api/warehouses')

function user(id: string, overrides: Partial<ManagedUser> = {}): ManagedUser {
  return {
    id,
    name: `Usuario ${id}`,
    email: `${id}@b.co`,
    role: 'WAREHOUSE_MANAGER',
    active: true,
    warehouseIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function pageOf(users: ManagedUser[], page = 1, total = users.length) {
  return { data: users, page, pageSize: 10, total }
}

const FORM: UserFormValue = {
  email: 'jefe@b.co',
  name: 'Jefe nuevo',
  role: 'WAREHOUSE_MANAGER',
  password: 'Clave-segura-2026',
  active: true,
  warehouseIds: ['wa'],
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  vi.useRealTimers()
  vi.mocked(api.listUsers).mockResolvedValue(pageOf([user('u1')]))
})

describe('store users: listado', () => {
  it('empieza en idle y vacío', () => {
    const store = useUsersStore()
    expect(store.status).toBe('idle')
    expect(store.items).toEqual([])
  })

  it('fetchPage pasa por loading y deja los datos normalizados (byId + ids)', async () => {
    vi.mocked(api.listUsers).mockResolvedValue(pageOf([user('u1'), user('u2')], 1, 12))
    const store = useUsersStore()
    const loading = store.fetchPage(1)
    expect(store.status).toBe('loading')
    await loading

    expect(store.status).toBe('success')
    expect(store.ids).toEqual(['u1', 'u2'])
    expect(store.byId.u2?.email).toBe('u2@b.co')
    expect(store.totalPages).toBe(2)
    expect(api.listUsers).toHaveBeenCalledWith(1, 10)
  })

  it('si la API falla queda en error con el mensaje', async () => {
    vi.mocked(api.listUsers).mockRejectedValue(new ApiError('Sin permiso', 403, null, null))
    const store = useUsersStore()
    await store.fetchPage(1)
    expect(store.status).toBe('error')
    expect(store.error).toBe('Sin permiso')
  })

  it('usa la caché mientras está vigente y vuelve a pedir al vencer', async () => {
    vi.useFakeTimers()
    const store = useUsersStore()
    await store.fetchPage(1)
    await store.fetchPage(1)
    expect(api.listUsers).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(CACHE_TTL_MS)
    await store.fetchPage(1)
    expect(api.listUsers).toHaveBeenCalledTimes(2)
  })

  it('loadWarehouses carga las bodegas y sus nombres', async () => {
    vi.mocked(warehousesApi.listWarehouses).mockResolvedValue({
      data: [{ id: 'wa', code: 'A', name: 'Bodega A', active: true, createdAt: '' }],
      page: 1,
      pageSize: 100,
      total: 1,
    })
    const store = useUsersStore()
    await store.loadWarehouses()
    expect(store.optionsStatus).toBe('success')
    expect(store.warehouseNames).toEqual({ wa: 'A · Bodega A' })
  })
})

describe('store users: guardar', () => {
  it('crea el usuario, le asigna las bodegas y recarga la página', async () => {
    vi.mocked(api.createUser).mockResolvedValue(user('u9'))
    vi.mocked(api.setUserWarehouses).mockResolvedValue({ userId: 'u9', warehouseIds: ['wa'] })
    const store = useUsersStore()

    expect(await store.save(FORM)).toEqual({ ok: true })

    expect(api.createUser).toHaveBeenCalledWith({
      email: 'jefe@b.co',
      name: 'Jefe nuevo',
      role: 'WAREHOUSE_MANAGER',
      password: 'Clave-segura-2026',
      active: true,
    })
    expect(api.setUserWarehouses).toHaveBeenCalledWith('u9', ['wa'])
    expect(api.listUsers).toHaveBeenCalledTimes(1)
    expect(store.saving).toBe(false)
  })

  it('al editar sin contraseña no la envía y no toca las bodegas si no cambiaron', async () => {
    const existing = user('u1', { warehouseIds: ['wa'] })
    vi.mocked(api.updateUser).mockResolvedValue(existing)
    const store = useUsersStore()

    await store.save({ ...FORM, password: '' }, existing)

    expect(api.updateUser).toHaveBeenCalledWith('u1', {
      email: 'jefe@b.co',
      name: 'Jefe nuevo',
      role: 'WAREHOUSE_MANAGER',
      active: true,
    })
    expect(api.setUserWarehouses).not.toHaveBeenCalled()
  })

  it('a un ADMIN o AUDITOR le quita las bodegas (ven todas)', async () => {
    const existing = user('u1', { warehouseIds: ['wa'] })
    vi.mocked(api.updateUser).mockResolvedValue({ ...existing, role: 'AUDITOR' })
    vi.mocked(api.setUserWarehouses).mockResolvedValue({ userId: 'u1', warehouseIds: [] })
    const store = useUsersStore()

    await store.save({ ...FORM, role: 'AUDITOR' }, existing)

    expect(api.setUserWarehouses).toHaveBeenCalledWith('u1', [])
  })

  it('un error de la API (correo repetido) queda en saveError y no asigna bodegas', async () => {
    vi.mocked(api.createUser).mockRejectedValue(
      new ApiError('Ya existe un usuario con ese correo', 409, 'CONFLICT', null),
    )
    const store = useUsersStore()

    expect(await store.save(FORM)).toEqual({ ok: false, user: null })
    expect(store.saveError).toBe('Ya existe un usuario con ese correo')
    expect(api.setUserWarehouses).not.toHaveBeenCalled()
    expect(store.saving).toBe(false)
  })

  it('si falla la asignación de bodegas devuelve el usuario creado para no duplicarlo', async () => {
    const created = user('u9')
    vi.mocked(api.createUser).mockResolvedValue(created)
    vi.mocked(api.setUserWarehouses).mockRejectedValue(new ApiError('Caído', 503, null, null))
    const store = useUsersStore()

    expect(await store.save(FORM)).toEqual({ ok: false, user: created })
    expect(store.saveError).toBe(
      'El usuario se guardó, pero no se pudieron asignar las bodegas: Caído',
    )
  })

  it('no envía dos veces si ya está guardando (doble clic)', async () => {
    vi.mocked(api.createUser).mockResolvedValue(user('u9', { warehouseIds: ['wa'] }))
    const store = useUsersStore()
    const first = store.save(FORM)
    const second = store.save(FORM)
    await Promise.all([first, second])
    expect(api.createUser).toHaveBeenCalledTimes(1)
  })
})

describe('store users: activar y desactivar', () => {
  it('desactiva enviando los demás datos sin cambios y recarga', async () => {
    const existing = user('u1', { role: 'OPERATOR' })
    vi.mocked(api.updateUser).mockResolvedValue({ ...existing, active: false })
    const store = useUsersStore()

    expect(await store.setActive(existing, false)).toBe(true)
    expect(api.updateUser).toHaveBeenCalledWith('u1', {
      email: 'u1@b.co',
      name: 'Usuario u1',
      role: 'OPERATOR',
      active: false,
    })
    expect(api.listUsers).toHaveBeenCalledTimes(1)
  })

  it('si falla deja el mensaje en actionError', async () => {
    vi.mocked(api.updateUser).mockRejectedValue(new ApiError('No existe', 404, null, null))
    const store = useUsersStore()
    expect(await store.setActive(user('u1'), false)).toBe(false)
    expect(store.actionError).toBe('No existe')
  })
})
