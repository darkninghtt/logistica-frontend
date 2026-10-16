import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import * as api from '@/api/products'
import { ApiError } from '@/api/http'
import { useProductsStore } from './products'
import type { Product } from '@/types/product'

vi.mock('@/api/products')

function product(sku: string): Product {
  return { id: `id-${sku}`, sku, name: `Producto ${sku}`, unit: 'un', createdAt: '2026-01-01' }
}

function pageOf(skus: string[], page = 1, total = skus.length) {
  return { data: skus.map(product), page, pageSize: 10, total }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

describe('store products', () => {
  it('empieza en idle y vacío', () => {
    const store = useProductsStore()
    expect(store.status).toBe('idle')
    expect(store.items).toEqual([])
  })

  it('fetchPage pasa por loading y deja los datos normalizados', async () => {
    vi.mocked(api.listProducts).mockResolvedValue(pageOf(['A', 'B'], 1, 12))
    const store = useProductsStore()

    const pending = store.fetchPage()
    expect(store.status).toBe('loading')
    await pending

    expect(store.status).toBe('success')
    expect(store.ids).toEqual(['id-A', 'id-B'])
    expect(store.byId['id-A']?.name).toBe('Producto A')
    expect(store.items.map((p) => p.sku)).toEqual(['A', 'B'])
    expect(store.total).toBe(12)
    expect(store.totalPages).toBe(2)
  })

  it('fetchPage pide la página indicada', async () => {
    vi.mocked(api.listProducts).mockResolvedValue(pageOf(['C'], 2, 11))
    const store = useProductsStore()

    await store.fetchPage(2)

    expect(api.listProducts).toHaveBeenCalledWith(2, 10)
    expect(store.page).toBe(2)
  })

  it('si la carga falla queda en error con el mensaje', async () => {
    vi.mocked(api.listProducts).mockRejectedValue(new ApiError('Sin permiso', 401, null, null))
    const store = useProductsStore()

    await store.fetchPage()

    expect(store.status).toBe('error')
    expect(store.error).toBe('Sin permiso')
  })

  it('save crea un producto y recarga la página', async () => {
    vi.mocked(api.createProduct).mockResolvedValue(product('A'))
    vi.mocked(api.listProducts).mockResolvedValue(pageOf(['A']))
    const store = useProductsStore()

    const ok = await store.save({ sku: 'A', name: 'Producto A', unit: 'un' })

    expect(ok).toBe(true)
    expect(api.createProduct).toHaveBeenCalledWith({ sku: 'A', name: 'Producto A', unit: 'un' })
    expect(api.listProducts).toHaveBeenCalledTimes(1)
    expect(store.saving).toBe(false)
  })

  it('save con id edita el producto', async () => {
    vi.mocked(api.updateProduct).mockResolvedValue(product('A'))
    vi.mocked(api.listProducts).mockResolvedValue(pageOf(['A']))
    const store = useProductsStore()

    await store.save({ sku: 'A', name: 'Nuevo', unit: 'kg' }, 'id-A')

    expect(api.updateProduct).toHaveBeenCalledWith('id-A', { sku: 'A', name: 'Nuevo', unit: 'kg' })
  })

  it('si guardar falla (SKU repetido) devuelve false, deja saveError y no recarga', async () => {
    vi.mocked(api.createProduct).mockRejectedValue(
      new ApiError('Ya existe un producto con ese SKU', 409, 'CONFLICT', 'abc'),
    )
    const store = useProductsStore()

    const ok = await store.save({ sku: 'A', name: 'Producto A', unit: 'un' })

    expect(ok).toBe(false)
    expect(store.saveError).toBe('Ya existe un producto con ese SKU')
    expect(store.saving).toBe(false)
    expect(api.listProducts).not.toHaveBeenCalled()
  })

  it('clearSaveError limpia el error de guardado', async () => {
    vi.mocked(api.createProduct).mockRejectedValue(new ApiError('x', 400, null, null))
    const store = useProductsStore()
    await store.save({ sku: 'A', name: 'A', unit: 'un' })

    store.clearSaveError()

    expect(store.saveError).toBeNull()
  })
})
