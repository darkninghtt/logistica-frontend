import type { Page } from '@/types/api'
import type { Product, ProductInput } from '@/types/product'
import { http } from './http'

export async function listProducts(page: number, pageSize: number): Promise<Page<Product>> {
  const res = await http.get<Page<Product>>('/products', { params: { page, pageSize } })
  return res.data
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const res = await http.post<Product>('/products', input)
  return res.data
}

export async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  const res = await http.put<Product>(`/products/${id}`, input)
  return res.data
}
