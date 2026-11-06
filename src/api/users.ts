import type {
  ManagedUser,
  ManagedUserPage,
  UserCreateInput,
  UserUpdateInput,
  UserWarehouses,
} from '@/types/user'
import { http } from './http'

export async function listUsers(page: number, pageSize: number): Promise<ManagedUserPage> {
  const res = await http.get<ManagedUserPage>('/users', { params: { page, pageSize } })
  return res.data
}

export async function createUser(input: UserCreateInput): Promise<ManagedUser> {
  const res = await http.post<ManagedUser>('/users', input)
  return res.data
}

export async function updateUser(id: string, input: UserUpdateInput): Promise<ManagedUser> {
  const res = await http.put<ManagedUser>(`/users/${id}`, input)
  return res.data
}

/** Reemplaza las bodegas asignadas al usuario. */
export async function setUserWarehouses(
  id: string,
  warehouseIds: string[],
): Promise<UserWarehouses> {
  const res = await http.put<UserWarehouses>(`/users/${id}/warehouses`, { warehouseIds })
  return res.data
}
