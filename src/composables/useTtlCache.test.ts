import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CACHE_TTL_MS, useTtlCache } from './useTtlCache'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useTtlCache', () => {
  it('sin cargas previas no está vigente', () => {
    const cache = useTtlCache()
    expect(cache.lastFetchedAt.value).toBeNull()
    expect(cache.isFresh()).toBe(false)
  })

  it('tras una carga está vigente durante el TTL y deja de estarlo al cumplirse', () => {
    const cache = useTtlCache()
    cache.markFetched()

    expect(CACHE_TTL_MS).toBe(60_000)
    vi.advanceTimersByTime(CACHE_TTL_MS - 1)
    expect(cache.isFresh()).toBe(true)
    vi.advanceTimersByTime(1)
    expect(cache.isFresh()).toBe(false)
  })

  it('solo vale para la misma consulta (key)', () => {
    const cache = useTtlCache()
    cache.markFetched('w-1|1')

    expect(cache.isFresh('w-1|1')).toBe(true)
    expect(cache.isFresh('w-1|2')).toBe(false)
    expect(cache.isFresh('w-2|1')).toBe(false)
  })

  it('invalidate descarta los datos', () => {
    const cache = useTtlCache()
    cache.markFetched()

    cache.invalidate()

    expect(cache.lastFetchedAt.value).toBeNull()
    expect(cache.isFresh()).toBe(false)
  })

  it('acepta un TTL propio', () => {
    const cache = useTtlCache(1000)
    cache.markFetched()
    vi.advanceTimersByTime(1000)
    expect(cache.isFresh()).toBe(false)
  })
})
