import { describe, expect, it } from 'vitest'
import { roleCan } from './permissions'

describe('roleCan', () => {
  it.each([
    ['ADMIN', 'catalog:write', true],
    ['ADMIN', 'stock:entry', true],
    ['WAREHOUSE_MANAGER', 'catalog:write', false],
    ['WAREHOUSE_MANAGER', 'stock:entry', true],
    ['OPERATOR', 'catalog:write', false],
    ['OPERATOR', 'stock:entry', false],
    ['AUDITOR', 'catalog:write', false],
    ['AUDITOR', 'stock:entry', false],
  ] as const)('%s · %s → %s', (role, permission, expected) => {
    expect(roleCan(role, permission)).toBe(expected)
  })

  it('sin rol (sin sesión) no hay permisos', () => {
    expect(roleCan(null, 'stock:entry')).toBe(false)
  })
})
