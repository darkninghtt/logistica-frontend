import { describe, expect, it } from 'vitest'
import { roleCan } from './permissions'

describe('roleCan', () => {
  it.each([
    ['ADMIN', 'catalog:write', true],
    ['ADMIN', 'stock:entry', true],
    ['ADMIN', 'stock:shrinkage', false],
    ['WAREHOUSE_MANAGER', 'catalog:write', false],
    ['WAREHOUSE_MANAGER', 'stock:entry', true],
    ['WAREHOUSE_MANAGER', 'stock:shrinkage', true],
    ['OPERATOR', 'catalog:write', false],
    ['OPERATOR', 'stock:entry', false],
    ['OPERATOR', 'stock:shrinkage', true],
    ['AUDITOR', 'catalog:write', false],
    ['AUDITOR', 'stock:entry', false],
    ['AUDITOR', 'stock:shrinkage', false],
    ['ADMIN', 'transfer:create', false],
    ['ADMIN', 'transfer:dispatch', false],
    ['WAREHOUSE_MANAGER', 'transfer:create', true],
    ['WAREHOUSE_MANAGER', 'transfer:dispatch', true],
    ['OPERATOR', 'transfer:create', true],
    ['OPERATOR', 'transfer:dispatch', false],
    ['AUDITOR', 'transfer:create', false],
    ['AUDITOR', 'transfer:dispatch', false],
    ['ADMIN', 'transfer:receive', false],
    ['ADMIN', 'transfer:resolve', true],
    ['WAREHOUSE_MANAGER', 'transfer:receive', true],
    ['WAREHOUSE_MANAGER', 'transfer:resolve', true],
    ['OPERATOR', 'transfer:receive', true],
    ['OPERATOR', 'transfer:resolve', false],
    ['AUDITOR', 'transfer:receive', false],
    ['AUDITOR', 'transfer:resolve', false],
  ] as const)('%s · %s → %s', (role, permission, expected) => {
    expect(roleCan(role, permission)).toBe(expected)
  })

  it('sin rol (sin sesión) no hay permisos', () => {
    expect(roleCan(null, 'stock:entry')).toBe(false)
  })
})
