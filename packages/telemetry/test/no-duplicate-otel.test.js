import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const require = createRequire(import.meta.url)

test('every @opentelemetry/* package resolves to a single version in the telemetry dep tree', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const seed = [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {})
  ]

  const versions = new Map()
  const visited = new Set()

  const visit = (name, fromDir) => {
    let pkgJsonPath
    try {
      pkgJsonPath = require.resolve(`${name}/package.json`, { paths: [fromDir] })
    } catch {
      return
    }
    if (visited.has(pkgJsonPath)) return
    visited.add(pkgJsonPath)

    const pj = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
    if (pj.name?.startsWith('@opentelemetry/')) {
      if (!versions.has(pj.name)) versions.set(pj.name, new Set())
      versions.get(pj.name).add(pj.version)
    }

    const dir = dirname(pkgJsonPath)
    for (const dep of Object.keys(pj.dependencies ?? {})) {
      visit(dep, dir)
    }
  }

  for (const name of seed) {
    visit(name, import.meta.dirname)
  }

  const dupes = [...versions.entries()]
    .filter(([, s]) => s.size > 1)
    .map(([n, s]) => `  ${n}: ${[...s].sort().join(', ')}`)

  assert.equal(
    dupes.length,
    0,
    'Duplicate @opentelemetry/* versions detected in the @platformatic/telemetry dep tree.\n' +
      'Each @opentelemetry/* package must resolve to exactly one version, otherwise ' +
      'instrumentations and the SDK will use mismatched class instances and lose spans.\n' +
      'Fix by aligning the pinned versions in package.json with what @opentelemetry/sdk-node pins.\n\n' +
      `Duplicates:\n${dupes.join('\n')}`
  )
})
