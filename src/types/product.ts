import type { ApiSchema } from './contract'

export type Product = ApiSchema<'Product'>

/** Cuerpo de POST y PUT /api/products. */
export type ProductInput = ApiSchema<'ProductInput'>

/** GET /api/products. */
export type ProductPage = ApiSchema<'ProductPage'>
