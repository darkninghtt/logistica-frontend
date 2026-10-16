import type { StockEntryInput, StockEntryResult } from '@/types/stockEntry'
import { http } from './http'

export async function createStockEntry(input: StockEntryInput): Promise<StockEntryResult> {
  const res = await http.post<StockEntryResult>('/stock/entries', input)
  return res.data
}
