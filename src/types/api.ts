/** Estado de carga explícito de un store. */
export type LoadStatus = 'idle' | 'loading' | 'success' | 'error'

/** Lista paginada de la API: `{ data, page, pageSize, total }`. */
export interface Page<T> {
  data: T[]
  page: number
  pageSize: number
  total: number
}
