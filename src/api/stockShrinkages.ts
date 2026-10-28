import type { StockShrinkageInput, StockShrinkageResult } from '@/types/stockShrinkage'
import { http } from './http'

export async function createStockShrinkage(
  input: StockShrinkageInput,
): Promise<StockShrinkageResult> {
  const res = await http.post<StockShrinkageResult>('/stock/shrinkage', input)
  return res.data
}
