import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
      const error = new Error('Detected circular dependency')
      error.path = path.concat([node]).join(' -> ')
      throw error
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
