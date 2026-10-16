/** Lista paginada de la API: `{ data, page, pageSize, total }`. */
export interface Page<T> {
  data: T[]
  page: number
  pageSize: number
  total: number
}
