import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ApplicationsDependenciesCycleError } from './errors.js'

export function getArrayDifference (a, b) {
  return a.filter(element => {
    return !b.includes(element)
  })
}

export function getApplicationUrl (id) {
  return `http://${id}.plt.local`
}

export function getRuntimeTmpDir (runtimeDir) {
  const platformaticTmpDir = join(tmpdir(), 'platformatic', 'applications')
  const runtimeDirHash = createHash('md5').update(runtimeDir).digest('hex')
  return join(platformaticTmpDir, runtimeDirHash)
}

// Given a topologically sorted list and the dependency graph,
// group nodes into levels where each level's dependencies are all in previous levels.
// This allows starting each level in parallel while respecting dependency order.
export function topologicalLevels (sorted, graph) {
  const levels = []
  const levelOf = new Map()

  for (const node of sorted) {
    const deps = graph.get(node) ?? []
    let level = 0

    for (const dep of deps) {
      if (levelOf.has(dep)) {
        level = Math.max(level, levelOf.get(dep) + 1)
      }
    }

    levelOf.set(node, level)

    while (levels.length <= level) {
      levels.push([])
    }

    levels[level].push(node)
  }

  return levels
}

// Graph: Map<string, string[]>
export function topologicalSort (graph) {
  const result = []
  const visited = new Set()
  const path = []

  function visit (node) {
    if (visited.has(node)) {
      return
    }

    if (path.includes(node)) {
      throw new ApplicationsDependenciesCycleError(path.concat([node]).join(' -> '))
    }

    path.push(node)
    for (const dep of graph.get(node)) {
      visit(dep)
    }
    path.pop()

    visited.add(node)
    result.push(node)
  }

  for (const node of graph.keys()) {
    visit(node)
  }

  return result
}
