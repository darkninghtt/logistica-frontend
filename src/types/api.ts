/** Estado de carga explícito de un store. */
export type LoadStatus = 'idle' | 'loading' | 'success' | 'error'

/**
 * Lista paginada por cursor: `nextCursor` se envía como `cursor` para pedir la siguiente;
 * es null cuando ya no hay más.
 */
export interface CursorPage<T> {
  data: T[]
  nextCursor: string | null
}

/** Lista paginada de la API: `{ data, page, pageSize, total }`. */
export interface Page<T> {
  data: T[]
  page: number
  pageSize: number
  total: number
}
