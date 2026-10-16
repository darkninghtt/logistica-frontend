export interface Product {
  id: string
  sku: string
  name: string
  unit: string
  createdAt: string
}

/** Cuerpo de POST y PUT /api/products. */
export interface ProductInput {
  sku: string
  name: string
  unit: string
}
