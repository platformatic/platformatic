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
