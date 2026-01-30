'use strict'

import { deepStrictEqual } from 'node:assert'
import test from 'node:test'
import { topologicalSort } from '../index.js'

test('topologicalSort - sorts items with no dependencies', () => {
  const items = [
    { id: 'a' },
    { id: 'b' },
    { id: 'c' }
  ]

  const result = topologicalSort(items)
  deepStrictEqual(result, ['a', 'b', 'c'])
})

test('topologicalSort - sorts items with linear dependencies', () => {
  const items = [
    { id: 'c', dependencies: ['b'] },
    { id: 'b', dependencies: ['a'] },
    { id: 'a', dependencies: [] }
  ]

  const result = topologicalSort(items)
  deepStrictEqual(result, ['a', 'b', 'c'])
})

test('topologicalSort - sorts items with multiple dependencies', () => {
  const items = [
    { id: 'app', dependencies: ['db', 'cache'] },
    { id: 'db' },
    { id: 'cache' }
  ]

  const result = topologicalSort(items)

  // db and cache should come before app
  const appIndex = result.indexOf('app')
  const dbIndex = result.indexOf('db')
  const cacheIndex = result.indexOf('cache')

  deepStrictEqual(dbIndex < appIndex, true)
  deepStrictEqual(cacheIndex < appIndex, true)
})

test('topologicalSort - handles diamond dependencies', () => {
  // Diamond: d depends on b and c, both depend on a
  const items = [
    { id: 'd', dependencies: ['b', 'c'] },
    { id: 'c', dependencies: ['a'] },
    { id: 'b', dependencies: ['a'] },
    { id: 'a' }
  ]

  const result = topologicalSort(items)

  const aIndex = result.indexOf('a')
  const bIndex = result.indexOf('b')
  const cIndex = result.indexOf('c')
  const dIndex = result.indexOf('d')

  // a must come before b and c
  deepStrictEqual(aIndex < bIndex, true)
  deepStrictEqual(aIndex < cIndex, true)
  // b and c must come before d
  deepStrictEqual(bIndex < dIndex, true)
  deepStrictEqual(cIndex < dIndex, true)
})

test('topologicalSort - ignores dependencies not in the set', () => {
  const items = [
    { id: 'a', dependencies: ['external'] },
    { id: 'b', dependencies: ['a'] }
  ]

  const result = topologicalSort(items)
  deepStrictEqual(result, ['a', 'b'])
})

test('topologicalSort - handles undefined dependencies', () => {
  const items = [
    { id: 'a' },
    { id: 'b', dependencies: ['a'] }
  ]

  const result = topologicalSort(items)
  deepStrictEqual(result, ['a', 'b'])
})

test('topologicalSort - throws on simple cycle and mentions involved services', () => {
  const items = [
    { id: 'service-a', dependencies: ['service-b'] },
    { id: 'service-b', dependencies: ['service-a'] }
  ]

  try {
    topologicalSort(items)
    throw new Error('Expected to throw')
  } catch (err) {
    deepStrictEqual(err.message.includes('Circular dependency detected'), true)
    deepStrictEqual(err.message.includes('service-a'), true)
    deepStrictEqual(err.message.includes('service-b'), true)
  }
})

test('topologicalSort - throws on complex cycle and mentions involved services', () => {
  const items = [
    { id: 'api', dependencies: ['db'] },
    { id: 'db', dependencies: ['cache'] },
    { id: 'cache', dependencies: ['api'] }
  ]

  try {
    topologicalSort(items)
    throw new Error('Expected to throw')
  } catch (err) {
    deepStrictEqual(err.message.includes('Circular dependency detected'), true)
    deepStrictEqual(err.message.includes('api'), true)
    deepStrictEqual(err.message.includes('db'), true)
    deepStrictEqual(err.message.includes('cache'), true)
  }
})

test('topologicalSort - throws on self-dependency and mentions the service', () => {
  const items = [
    { id: 'self-ref', dependencies: ['self-ref'] }
  ]

  try {
    topologicalSort(items)
    throw new Error('Expected to throw')
  } catch (err) {
    deepStrictEqual(err.message.includes('Circular dependency detected'), true)
    deepStrictEqual(err.message.includes('self-ref'), true)
  }
})

test('topologicalSort - handles complex dependency tree', () => {
  // A -> (B, C), B -> (C, D), D -> E
  const items = [
    { id: 'A', dependencies: ['B', 'C'] },
    { id: 'B', dependencies: ['C', 'D'] },
    { id: 'C' },
    { id: 'D', dependencies: ['E'] },
    { id: 'E' }
  ]

  const result = topologicalSort(items)

  const indexOf = id => result.indexOf(id)

  // E must come before D
  deepStrictEqual(indexOf('E') < indexOf('D'), true)
  // D must come before B
  deepStrictEqual(indexOf('D') < indexOf('B'), true)
  // C must come before B and A
  deepStrictEqual(indexOf('C') < indexOf('B'), true)
  deepStrictEqual(indexOf('C') < indexOf('A'), true)
  // B must come before A
  deepStrictEqual(indexOf('B') < indexOf('A'), true)
})

test('topologicalSort - handles empty array', () => {
  const result = topologicalSort([])
  deepStrictEqual(result, [])
})

test('topologicalSort - handles single item', () => {
  const items = [{ id: 'a' }]
  const result = topologicalSort(items)
  deepStrictEqual(result, ['a'])
})
