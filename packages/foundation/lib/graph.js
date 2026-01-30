'use strict'

/**
 * Topological sort using Kahn's algorithm.
 * Orders items so that dependencies come before dependents.
 *
 * Each item must have:
 * - `id` (string): unique identifier
 * - `dependencies` (array, optional): array of dependency IDs
 *
 * @param {Array<{id: string, dependencies?: string[]}>} items - Array of items to sort
 * @returns {Array<string>} - Array of IDs in topological order
 * @throws {Error} - If a cycle is detected in the dependency graph
 */
export function topologicalSort (items) {
  const ids = items.map(item => item.id)
  const idSet = new Set(ids)

  // Build adjacency list and in-degree count
  const inDegree = new Map()
  const dependents = new Map() // dependency -> [items that depend on it]

  for (const item of items) {
    inDegree.set(item.id, 0)
    dependents.set(item.id, [])
  }

  for (const item of items) {
    const deps = item.dependencies ?? []
    for (const dep of deps) {
      // Only count dependencies that exist in the set
      if (idSet.has(dep)) {
        inDegree.set(item.id, inDegree.get(item.id) + 1)
        dependents.get(dep).push(item.id)
      }
    }
  }

  // Start with items that have no dependencies
  const queue = []
  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      queue.push(id)
    }
  }

  const sorted = []
  while (queue.length > 0) {
    const id = queue.shift()
    sorted.push(id)

    for (const dependent of dependents.get(id)) {
      inDegree.set(dependent, inDegree.get(dependent) - 1)
      if (inDegree.get(dependent) === 0) {
        queue.push(dependent)
      }
    }
  }

  // If not all items were sorted, there's a cycle
  if (sorted.length !== ids.length) {
    const cycleNodes = ids.filter(id => !sorted.includes(id))
    throw new Error(`Circular dependency detected involving: ${cycleNodes.join(', ')}`)
  }

  return sorted
}
