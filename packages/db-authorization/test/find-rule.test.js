import { deepEqual } from 'node:assert'
import { test } from 'node:test'
import { findRule } from '../lib/find-rule.js'

const allowAll = {
  save: true,
  find: true,
  delete: true
}
const denyAll = {
  save: false,
  find: false,
  delete: false
}

test('should return first rule that match', t => {
  const roles = ['role1']
  const rules = [
    {
      _id: 'RULE1',
      role: 'role1',
      entity: 'page',
      ...allowAll
    },
    {
      _id: 'RULE2',
      role: 'role2',
      entity: 'page',
      ...allowAll
    },
    {
      _id: 'RULE3',
      role: 'role1',
      entity: 'page',
      ...denyAll
    }
  ]
  const found = findRule(rules, roles)
  deepEqual(found._id, 'RULE1')
})

test('should return null if no match', t => {
  const roles = ['role3']
  const rules = [
    {
      _id: 'RULE1',
      role: 'role1',
      entity: 'page',
      ...allowAll
    },
    {
      _id: 'RULE2',
      role: 'role2',
      entity: 'page',
      ...allowAll
    },
    {
      _id: 'RULE3',
      role: 'role1',
      entity: 'page',
      ...denyAll
    }
  ]
  const found = findRule(rules, roles)
  deepEqual(found, null)
})

test('should search all roles until match', t => {
  const roles = ['role3', 'role2']
  const rules = [
    {
      _id: 'RULE1',
      role: 'role1',
      entity: 'page',
      ...allowAll
    },
    {
      _id: 'RULE2',
      role: 'role2',
      entity: 'page',
      ...allowAll
    },
    {
      _id: 'RULE3',
      role: 'role1',
      entity: 'page',
      ...denyAll
    }
  ]
  const found = findRule(rules, roles)
  deepEqual(found._id, 'RULE2')
})

test('multi-role: most permissive wins - true wins over false', t => {
  const roles = ['member', 'super-admin']
  const rules = [
    {
      _id: 'MEMBER',
      role: 'member',
      entity: 'movie',
      find: true,
      save: false,
      delete: false
    },
    {
      _id: 'SUPER_ADMIN',
      role: 'super-admin',
      entity: 'movie',
      find: true,
      save: true,
      delete: true
    }
  ]
  const found = findRule(rules, roles)
  deepEqual(found.save, true)
  deepEqual(found.delete, true)
  deepEqual(found.find, true)
})

test('multi-role: order of rules should not matter', t => {
  const roles = ['member', 'super-admin']

  const rulesOrder1 = [
    { _id: 'MEMBER', role: 'member', entity: 'movie', save: false },
    { _id: 'SUPER_ADMIN', role: 'super-admin', entity: 'movie', save: true }
  ]

  const rulesOrder2 = [
    { _id: 'SUPER_ADMIN', role: 'super-admin', entity: 'movie', save: true },
    { _id: 'MEMBER', role: 'member', entity: 'movie', save: false }
  ]

  const found1 = findRule(rulesOrder1, roles)
  const found2 = findRule(rulesOrder2, roles)

  deepEqual(found1.save, true)
  deepEqual(found2.save, true)
})

test('multi-role: order of roles should not matter', t => {
  const roles1 = ['member', 'super-admin']
  const roles2 = ['super-admin', 'member']

  const rules = [
    { _id: 'MEMBER', role: 'member', entity: 'movie', save: false },
    { _id: 'SUPER_ADMIN', role: 'super-admin', entity: 'movie', save: true }
  ]

  const found1 = findRule(rules, roles1)
  const found2 = findRule(rules, roles2)

  deepEqual(found1.save, true)
  deepEqual(found2.save, true)
})

test('multi-role: object permission wins over false', t => {
  const roles = ['blocked', 'user']
  const rules = [
    {
      _id: 'BLOCKED',
      role: 'blocked',
      entity: 'page',
      find: true,
      save: false,
      delete: false
    },
    {
      _id: 'USER',
      role: 'user',
      entity: 'page',
      find: true,
      delete: false,
      save: {
        checks: {
          userId: 'X-PLATFORMATIC-USER-ID'
        }
      }
    }
  ]
  const found = findRule(rules, roles)
  deepEqual(found.save, { checks: { userId: 'X-PLATFORMATIC-USER-ID' } })
})

test('multi-role: defaults are merged', t => {
  const roles = ['role1', 'role2']
  const rules = [
    {
      _id: 'RULE1',
      role: 'role1',
      entity: 'page',
      save: true,
      defaults: {
        field1: 'value1'
      }
    },
    {
      _id: 'RULE2',
      role: 'role2',
      entity: 'page',
      save: true,
      defaults: {
        field2: 'value2'
      }
    }
  ]
  const found = findRule(rules, roles)
  deepEqual(found.defaults, { field1: 'value1' })
})

test('single role: returns exact rule', t => {
  const roles = ['admin']
  const rules = [
    {
      _id: 'ADMIN',
      role: 'admin',
      entity: 'page',
      save: true,
      delete: true
    }
  ]
  const found = findRule(rules, roles)
  deepEqual(found._id, 'ADMIN')
  deepEqual(found.save, true)
  deepEqual(found.delete, true)
})
