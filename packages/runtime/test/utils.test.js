import { deepStrictEqual, throws } from 'node:assert'
import { deepEqual, equal, ok } from 'node:assert/strict'
import { test } from 'node:test'
import { getMemoryInfo } from '../lib/metrics.js'
import { getArrayDifference, topologicalSort } from '../lib/utils.js'

test('getArrayDifference', async () => {
  const a = [1, 2, 3]
  const b = [2, 3, 4]

  deepEqual(getArrayDifference(a, b), [1])
  deepEqual(getArrayDifference(b, a), [4])
})

test('getMemoryInfo - should get the host memory info', async () => {
  const memInfo = await getMemoryInfo()
  equal(memInfo.scope, 'host')
  ok(memInfo.used > 0)
  ok(memInfo.total > 0)
  ok(memInfo.used <= memInfo.total)
})

test('topologicalSort - should properly sort simple linear dependency', () => {
  const graph = new Map([
    ['A', ['B']],
    ['B', ['C']],
    ['C', []]
  ])

  deepStrictEqual(topologicalSort(graph), ['C', 'B', 'A'])
})

test('topologicalSort - should properly sort multiple independent nodes', () => {
  const graph = new Map([
    ['A', ['B']],
    ['B', []],
    ['C', ['D']],
    ['D', []]
  ])

  deepStrictEqual(topologicalSort(graph), ['B', 'A', 'D', 'C'])
})

test('topologicalSort - should properly sort complex dependency graph', () => {
  // A -> B -> D
  // A -> C -> D
  // E -> F
  const graph = new Map([
    ['A', ['B', 'C']],
    ['B', ['D']],
    ['C', ['D']],
    ['D', []],
    ['E', ['F']],
    ['F', []]
  ])

  deepStrictEqual(topologicalSort(graph), ['D', 'B', 'C', 'A', 'F', 'E'])
})

test('topologicalSort - should properly sort diamond dependencies', () => {
  // A -> B -> D
  // A -> C -> D
  const graph = new Map([
    ['A', ['B', 'C']],
    ['B', ['D']],
    ['C', ['D']],
    ['D', []]
  ])

  deepStrictEqual(topologicalSort(graph), ['D', 'B', 'C', 'A'])
})

test('topologicalSort - should properly sort a empty graph', () => {
  deepStrictEqual(topologicalSort(new Map()), [])
})

test('topologicalSort - should properly sort a single node with no dependencies', () => {
  const graph = new Map([['A', []]])
  deepStrictEqual(topologicalSort(graph), ['A'])
})

test('topologicalSort - should properly detect circular dependencies', () => {
  // A -> B -> C -> A (circular)
  const graph = new Map([
    ['A', ['B']],
    ['B', ['C']],
    ['C', ['A']]
  ])

  throws(
    () => topologicalSort(graph),
    err => {
      deepStrictEqual(err.message, 'Detected a cycle in the applications dependencies: A -> B -> C -> A')
      return true
    }
  )
})

test('topologicalSort - should properly detect self-referencing nodes', () => {
  const graph = new Map([['A', ['A']]])

  throws(
    () => topologicalSort(graph),
    err => {
      deepStrictEqual(err.message, 'Detected a cycle in the applications dependencies: A -> A')
      return true
    }
  )
})

test('topologicalSort - should properly detect circular dependencies in a complex graph', () => {
  // A -> B -> C
  // D -> E -> F -> D (circular)
  const graph = new Map([
    ['A', ['B']],
    ['B', ['C']],
    ['C', []],
    ['D', ['E']],
    ['E', ['F']],
    ['F', ['D']]
  ])

  throws(
    () => topologicalSort(graph),
    err => {
      deepStrictEqual(err.message, 'Detected a cycle in the applications dependencies: D -> E -> F -> D')
      return true
    }
  )
})

test('topologicalSort - should properly sort multiple paths to same node', () => {
  // A -> C
  // B -> C
  // C -> D
  const graph = new Map([
    ['A', ['C']],
    ['B', ['C']],
    ['C', ['D']],
    ['D', []]
  ])

  deepStrictEqual(topologicalSort(graph), ['D', 'C', 'A', 'B'])
})

test('topologicalSort - should properly sort deep dependency chain', () => {
  // A -> B -> C -> D -> E -> F
  const graph = new Map([
    ['A', ['B']],
    ['B', ['C']],
    ['C', ['D']],
    ['D', ['E']],
    ['E', ['F']],
    ['F', []]
  ])

  deepStrictEqual(topologicalSort(graph), ['F', 'E', 'D', 'C', 'B', 'A'])
})

test('topologicalSort - should properly sort forest graphs (multiple disconnected trees)', () => {
  // Tree 1: A -> B
  // Tree 2: C -> D
  // Tree 3: E (standalone)
  const graph = new Map([
    ['A', ['B']],
    ['B', []],
    ['C', ['D']],
    ['D', []],
    ['E', []]
  ])

  deepStrictEqual(topologicalSort(graph), ['B', 'A', 'D', 'C', 'E'])
})

test('topologicalSort - should properly sort shared dependency', () => {
  // A -> D
  // B -> D
  // C -> D
  // D -> E
  const graph = new Map([
    ['A', ['D']],
    ['B', ['D']],
    ['C', ['D']],
    ['D', ['E']],
    ['E', []]
  ])

  deepStrictEqual(topologicalSort(graph), ['E', 'D', 'A', 'B', 'C'])
})
