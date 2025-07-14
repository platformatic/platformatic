import { deepEqual } from 'node:assert'
import test from 'node:test'
import { omitProperties, overridableValue, removeDefaults } from '../index.js'

test('overridableValue - should create schema with anyOf and default', () => {
  const spec = { type: 'number', minimum: 0 }
  const defaultValue = 42
  const result = overridableValue(spec, defaultValue)

  deepEqual(result, {
    anyOf: [spec, { type: 'string' }],
    default: defaultValue
  })
})

test('overridableValue - should create schema with anyOf without default', () => {
  const spec = { type: 'boolean' }
  const result = overridableValue(spec)

  deepEqual(result, {
    anyOf: [spec, { type: 'string' }]
  })
})

test('removeDefaults - should remove default values from schema properties', () => {
  const schema = {
    properties: {
      name: { type: 'string', default: 'test' },
      age: { type: 'number', default: 18 },
      active: { type: 'boolean' }
    }
  }

  const result = removeDefaults(schema)

  deepEqual(result, {
    properties: {
      name: { type: 'string' },
      age: { type: 'number' },
      active: { type: 'boolean' }
    }
  })
})

test('omitProperties - should omit properties from object with array input', () => {
  const obj = { a: 1, b: 2, c: 3, d: 4 }
  const result = omitProperties(obj, ['b', 'd'])

  deepEqual(result, { a: 1, c: 3 })
})

test('omitProperties - should omit properties from object with string input', () => {
  const obj = { a: 1, b: 2, c: 3 }
  const result = omitProperties(obj, 'b')

  deepEqual(result, { a: 1, c: 3 })
})

test('omitProperties - should handle empty properties array', () => {
  const obj = { a: 1, b: 2, c: 3 }
  const result = omitProperties(obj, [])

  deepEqual(result, { a: 1, b: 2, c: 3 })
})

test('omitProperties - should handle non-existent properties', () => {
  const obj = { a: 1, b: 2 }
  const result = omitProperties(obj, ['c', 'd'])

  deepEqual(result, { a: 1, b: 2 })
})
