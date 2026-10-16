import type { LoginInput, LoginResponse } from '@/types/auth'
import { http } from './http'

export async function login(input: LoginInput): Promise<LoginResponse> {
  const res = await http.post<LoginResponse>('/auth/login', input)
  return res.data
}
