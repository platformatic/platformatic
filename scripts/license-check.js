#!/usr/bin/env node

// Walks the production dependency graph of every workspace package and collects
// the license of each third party dependency.
//
// The check fails when a dependency license is not satisfied by ALLOWED_LICENSES,
// so introducing a dependency with a new license requires an explicit, reviewed
// addition to the lists below.
//
// Usage:
//   node scripts/license-check.js                                  # check + summary
//   node scripts/license-check.js --format=markdown --out=FILE     # full list
//   node scripts/license-check.js --allow='CC0-1.0'                # extra licenses
//   node scripts/license-check.js --no-check                       # report only

import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Same base list as the Fastify quality workflow. Keep this list minimal: every
// license that is not listed here or in ADDITIONAL_LICENSES fails the check.
const BASE_LICENSES = [
  '0BSD',
  'Apache-2.0',
  'BlueOak-1.0.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'MIT'
]

// Licenses accepted on top of the base list. Only add a license here once a
// dependency actually needs it, together with the reason why it is acceptable.
const ADDITIONAL_LICENSES = {
  'Python-2.0': 'permissive, GPL compatible, no copyleft obligation on users of the code'
}

const ALLOWED_LICENSES = [...BASE_LICENSES, ...Object.keys(ADDITIONAL_LICENSES)]

// Per package exceptions, reviewed manually.
//
// - `match`: string or regular expression, compared against `name` and `name@version`.
// - `allow`: the exact license expression that is tolerated for this package.
// - `via`:   the only dependency this package may be reached through. If the package
//            is reachable from any workspace package without going through `via`,
//            the exception does not apply and the check fails.
// - `license`: overrides missing or non-SPDX metadata.
const PACKAGE_EXCEPTIONS = [
  {
    match: /^@img\/sharp-libvips-/,
    allow: 'LGPL-3.0-or-later',
    via: '@platformatic/image-optimizer',
    reason:
      'Prebuilt libvips binaries, pulled in as platform specific optional dependencies of sharp. ' +
      'They are loaded as unmodified shared libraries, so the LGPL does not extend to Platformatic. ' +
      'Same arrangement as Next.js. @platformatic/image-optimizer is the only module allowed to ' +
      'introduce an LGPL dependency.'
  }
]

function parseArgs (argv) {
  const options = { check: true, format: 'summary', out: null, allow: [], includePeer: false }

  for (const arg of argv) {
    if (arg === '--no-check') {
      options.check = false
    } else if (arg === '--include-peer') {
      options.includePeer = true
    } else if (arg.startsWith('--format=')) {
      options.format = arg.slice('--format='.length)
    } else if (arg.startsWith('--out=')) {
      options.out = arg.slice('--out='.length)
    } else if (arg.startsWith('--allow=')) {
      options.allow = arg
        .slice('--allow='.length)
        .split(';')
        .map(license => license.trim())
        .filter(Boolean)
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!['summary', 'json', 'markdown', 'text'].includes(options.format)) {
    throw new Error(`Unknown format: ${options.format}`)
  }

  return options
}

function readJson (path) {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function findException (name, version) {
  return PACKAGE_EXCEPTIONS.find(({ match }) => {
    if (match instanceof RegExp) {
      return match.test(name) || match.test(`${name}@${version}`)
    }

    return match === name || match === `${name}@${version}`
  })
}

async function listWorkspacePackages () {
  const entries = await readdir(join(ROOT, 'packages'), { withFileTypes: true })
  const packages = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const path = join(ROOT, 'packages', entry.name, 'package.json')

    if (existsSync(path)) {
      packages.push({ dir: join(ROOT, 'packages', entry.name), manifest: readJson(path) })
    }
  }

  return packages
}

// Node resolution: walk up looking for node_modules/<name>, stopping at the
// repository root. This works both with pnpm's hoisted layout and with the
// symlinked one, since we always resolve from the real path of a package.
function resolvePackageDir (name, fromDir) {
  let current = fromDir

  while (true) {
    const candidate = join(current, 'node_modules', name)

    if (existsSync(join(candidate, 'package.json'))) {
      return realpathSync(candidate)
    }

    if (current === ROOT) {
      return null
    }

    const parent = dirname(current)

    if (parent === current) {
      return null
    }

    current = parent
  }
}

function isWorkspacePackage (dir) {
  return dir.startsWith(ROOT + sep) && !dir.includes(`${sep}node_modules${sep}`)
}

// Normalizes the many shapes the license metadata can take into an SPDX-ish
// expression, or null when there is nothing usable.
function extractLicense (manifest) {
  if (typeof manifest.license === 'string') {
    return manifest.license.trim() || null
  }

  if (manifest.license && typeof manifest.license === 'object' && manifest.license.type) {
    return String(manifest.license.type).trim() || null
  }

  if (Array.isArray(manifest.licenses)) {
    const types = manifest.licenses.map(entry => (typeof entry === 'string' ? entry : entry?.type)).filter(Boolean)

    if (types.length === 1) {
      return types[0]
    }

    if (types.length > 1) {
      return `(${types.join(' OR ')})`
    }
  }

  return null
}

// Minimal SPDX expression evaluator: supports OR, AND, parentheses and the
// `WITH` operator, which is enough for the expressions found in the registry.
export function isLicenseAllowed (expression, allowed) {
  if (!expression) {
    return false
  }

  const tokens = expression.match(/\(|\)|[^\s()]+/g)

  if (!tokens) {
    return false
  }

  let position = 0

  // AND binds tighter than OR, as per the SPDX specification.
  function parseExpression () {
    let value = parseConjunction()

    while (tokens[position] === 'OR') {
      position++
      value = parseConjunction() || value
    }

    return value
  }

  function parseConjunction () {
    let value = parseTerm()

    while (tokens[position] === 'AND') {
      position++
      value = parseTerm() && value
    }

    return value
  }

  function parseTerm () {
    if (tokens[position] === '(') {
      position++
      const value = parseExpression()

      if (tokens[position] === ')') {
        position++
      }

      return value
    }

    let license = tokens[position++] ?? ''

    // `Apache-2.0 WITH LLVM-exception` and friends are matched as a whole.
    while (tokens[position] === 'WITH' && tokens[position + 1]) {
      license += ` WITH ${tokens[position + 1]}`
      position += 2
    }

    return allowed.has(license.replace(/\+$/, ''))
  }

  const result = parseExpression()

  return position === tokens.length && result
}

// Builds the production dependency graph, starting from every workspace package.
// Nodes are keyed by the real path of the package, so that different versions of
// the same package are distinct nodes.
async function buildGraph (options) {
  const workspacePackages = await listWorkspacePackages()
  const workspaceDirs = new Map(workspacePackages.map(({ dir, manifest }) => [manifest.name, dir]))
  const nodes = new Map()
  const edges = new Map()
  const missing = []
  const queue = []

  function addNode (dir, manifest) {
    const version = manifest.version ?? '0.0.0'
    const exception = findException(manifest.name, version)

    nodes.set(dir, {
      dir,
      manifest,
      name: manifest.name,
      version,
      license: exception?.license ?? extractLicense(manifest),
      exception,
      repository: normalizeRepository(manifest),
      path: relative(ROOT, dir),
      workspace: isWorkspacePackage(dir) || workspaceDirs.has(manifest.name)
    })
    edges.set(dir, new Set())
    queue.push(dir)
  }

  function dependencyNames (manifest) {
    const optional = new Set(Object.keys(manifest.optionalDependencies ?? {}))
    const names = new Set([
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.optionalDependencies ?? {})
    ])

    if (options.includePeer) {
      for (const name of Object.keys(manifest.peerDependencies ?? {})) {
        names.add(name)

        if (manifest.peerDependenciesMeta?.[name]?.optional) {
          optional.add(name)
        }
      }
    }

    return [...names].map(name => ({ name, optional: optional.has(name) }))
  }

  for (const { dir, manifest } of workspacePackages) {
    addNode(dir, manifest)
  }

  const roots = workspacePackages.map(({ dir, manifest }) => ({ dir, name: manifest.name }))

  while (queue.length > 0) {
    const dir = queue.shift()
    const node = nodes.get(dir)

    for (const { name, optional } of dependencyNames(node.manifest)) {
      // Workspace packages are always resolved from the workspace itself, the
      // node_modules link may be missing when the install is partial.
      const dependencyDir = workspaceDirs.get(name) ?? resolvePackageDir(name, dir)

      if (!dependencyDir) {
        missing.push({ name, requiredBy: node.name, optional })
        continue
      }

      if (!nodes.has(dependencyDir)) {
        addNode(dependencyDir, readJson(join(dependencyDir, 'package.json')))
      }

      edges.get(dir).add(dependencyDir)
    }
  }

  return { nodes, edges, roots, missing }
}

// Breadth first walk from `rootDir`, returning the parent of every reachable
// node so that a dependency chain can be reconstructed. Nodes named `skipName`
// are treated as if they did not exist.
function walkFrom (graph, rootDir, skipName = null) {
  const parents = new Map([[rootDir, null]])
  const queue = [rootDir]

  while (queue.length > 0) {
    const dir = queue.shift()

    for (const next of graph.edges.get(dir) ?? []) {
      if (parents.has(next) || graph.nodes.get(next).name === skipName) {
        continue
      }

      parents.set(next, dir)
      queue.push(next)
    }
  }

  return parents
}

function chainTo (graph, parents, dir) {
  const chain = []
  let current = dir

  while (current !== undefined && current !== null) {
    chain.unshift(graph.nodes.get(current).name)
    current = parents.get(current)
  }

  return chain
}

function analyze (graph, allowed) {
  // One walk per workspace package, so that every third party dependency can be
  // attributed back to the Platformatic packages that pull it in.
  const walks = graph.roots.map(root => ({ root, parents: walkFrom(graph, root.dir) }))

  // Set of nodes still reachable when a given package is removed from the graph,
  // used to verify the `via` constraint of an exception. Memoized per package name.
  const reachableWithout = new Map()

  function withoutVia (name) {
    if (!reachableWithout.has(name)) {
      const reachable = new Set()

      for (const root of graph.roots) {
        for (const dir of walkFrom(graph, root.dir, name).keys()) {
          reachable.add(dir)
        }
      }

      reachableWithout.set(name, reachable)
    }

    return reachableWithout.get(name)
  }

  // The same name@version can be installed at several physical paths, report it once.
  const merged = new Map()

  for (const node of graph.nodes.values()) {
    if (node.workspace) {
      continue
    }

    const dependents = new Set()
    let chain = null

    for (const { root, parents } of walks) {
      if (!parents.has(node.dir)) {
        continue
      }

      dependents.add(root.name)

      // Keep the shortest chain across all workspace packages, it is the most
      // readable explanation of why the dependency is there.
      const candidate = chainTo(graph, parents, node.dir)

      if (!chain || candidate.length < chain.length) {
        chain = candidate
      }
    }

    const { exception } = node
    const allowedByList = isLicenseAllowed(node.license, allowed)
    let allowedByException = false
    let violation = null

    if (!allowedByList && exception && exception.allow === node.license) {
      allowedByException = true

      // The exception is only valid if this copy cannot be reached any other way.
      if (exception.via && withoutVia(exception.via).has(node.dir)) {
        allowedByException = false
        violation = `reachable from a workspace package without going through ${exception.via}`
      }
    }

    const key = `${node.name}@${node.version}`
    const existing = merged.get(key)

    if (existing) {
      for (const dependent of dependents) {
        existing.dependents.add(dependent)
      }

      if (chain && (!existing.chain || chain.length < existing.chain.length)) {
        existing.chain = chain
      }

      // A copy that is not allowed makes the whole name@version not allowed.
      existing.allowed = existing.allowed && (allowedByList || allowedByException)
      existing.viaException = existing.viaException || allowedByException
      existing.violation = existing.violation ?? violation
      existing.paths.push(node.path)
      continue
    }

    merged.set(key, {
      name: node.name,
      version: node.version,
      license: node.license,
      repository: node.repository,
      paths: [node.path],
      dependents,
      chain,
      allowed: allowedByList || allowedByException,
      viaException: allowedByException,
      exception: allowedByException ? exception.reason : null,
      violation
    })
  }

  return [...merged.values()]
    .map(dependency => ({ ...dependency, dependents: [...dependency.dependents].sort() }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
}

function normalizeRepository (manifest) {
  const repository = typeof manifest.repository === 'string' ? manifest.repository : manifest.repository?.url

  if (!repository) {
    return manifest.homepage ?? null
  }

  return repository
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/^github:(.+)$/, 'https://github.com/$1')
}

function summarize (dependencies) {
  const counts = new Map()

  for (const dependency of dependencies) {
    const license = dependency.license ?? 'UNKNOWN'
    counts.set(license, (counts.get(license) ?? 0) + 1)
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

// Everything that the base list does not cover on its own, which is what needs
// to be looked at when reviewing the licenses we ship.
function notable (dependencies) {
  const base = new Set(BASE_LICENSES)

  return dependencies.filter(dependency => !base.has(dependency.license))
}

function rationale (dependency) {
  if (!dependency.allowed) {
    return `**Not allowed**${dependency.violation ? `: ${dependency.violation}` : ''}`
  }

  if (dependency.exception) {
    return `Reviewed exception: ${dependency.exception}`
  }

  if (ADDITIONAL_LICENSES[dependency.license]) {
    return `Allowed on top of the base list: ${ADDITIONAL_LICENSES[dependency.license]}`
  }

  return 'Allowed because the SPDX expression can be satisfied by a license in the base allow list.'
}

function renderMarkdown (dependencies) {
  const lines = [
    '# Third party licenses',
    '',
    'Licenses of all production dependencies of the Platformatic packages, generated by',
    '`pnpm run license-list`. Do not edit by hand.',
    '',
    'Platformatic itself is licensed under the Apache License 2.0, see [LICENSE](./LICENSE).',
    '',
    'Only `dependencies` and `optionalDependencies` are listed: `devDependencies` are not shipped and',
    '`peerDependencies` (`next`, `astro`, `vite`, ...) are installed by the user, not by us. Platform',
    'specific optional dependencies are listed for the platform the report was generated on.',
    '',
    '## Summary',
    '',
    '| License | Packages |',
    '| ------- | -------: |'
  ]

  for (const [license, count] of summarize(dependencies)) {
    lines.push(`| ${license} | ${count} |`)
  }

  lines.push('', `**Total:** ${dependencies.length} packages`, '')

  const interesting = notable(dependencies)

  if (interesting.length > 0) {
    lines.push('## Licenses outside the base allow list', '')
    lines.push(
      'The base allow list is `' + BASE_LICENSES.join('`, `') + '`. Every dependency below carries a',
      'different license expression, and is listed with the Platformatic packages that depend on it.',
      ''
    )

    const byLicense = new Map()

    for (const dependency of interesting) {
      const license = dependency.license ?? 'UNKNOWN'

      if (!byLicense.has(license)) {
        byLicense.set(license, [])
      }

      byLicense.get(license).push(dependency)
    }

    for (const [license, group] of [...byLicense.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      lines.push(`### ${license}`, '')

      for (const dependency of group) {
        lines.push(`- \`${dependency.name}@${dependency.version}\``)
        lines.push(`  - Platformatic packages: ${dependency.dependents.map(name => `\`${name}\``).join(', ') || 'none'}`)

        if (dependency.chain) {
          lines.push(`  - Pulled in by: ${dependency.chain.map(name => `\`${name}\``).join(' → ')}`)
        }

        lines.push(`  - ${rationale(dependency)}`)
      }

      lines.push('')
    }
  }

  lines.push('## Packages', '')
  lines.push('| Package | Version | License | Repository |')
  lines.push('| ------- | ------- | ------- | ---------- |')

  for (const dependency of dependencies) {
    const license = dependency.license ?? 'UNKNOWN'
    const flag = dependency.allowed ? '' : ' :warning:'
    const repository = dependency.repository ? `[link](${dependency.repository})` : ''

    lines.push(`| \`${dependency.name}\` | ${dependency.version} | ${license}${flag} | ${repository} |`)
  }

  lines.push('')

  return lines.join('\n')
}

function renderText (dependencies) {
  return dependencies.map(d => `${d.name}@${d.version}\t${d.license ?? 'UNKNOWN'}`).join('\n') + '\n'
}

function printNotable (dependencies, log) {
  const interesting = notable(dependencies)

  if (interesting.length === 0) {
    return
  }

  log('Dependencies whose license is not in the base allow list:\n')

  for (const dependency of interesting) {
    log(`  ${dependency.name}@${dependency.version}: ${dependency.license ?? 'UNKNOWN'}`)
    log(`    Platformatic packages: ${dependency.dependents.join(', ') || 'none'}`)

    if (dependency.chain) {
      log(`    Pulled in by: ${dependency.chain.join(' -> ')}`)
    }
  }

  log('')
}

function printHelp () {
  console.log(`Usage: node scripts/license-check.js [options]

Options:
  --format=<summary|json|markdown|text>  Output format (default: summary)
  --out=<file>                           Write the output to a file instead of stdout
  --allow=<a;b;c>                        Additional allowed SPDX licenses
  --include-peer                         Also traverse peerDependencies
  --no-check                             Report only, never fail
  -h, --help                             Show this help
`)
}

async function main () {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  const allowed = new Set([...ALLOWED_LICENSES, ...options.allow])
  const graph = await buildGraph(options)
  const dependencies = analyze(graph, allowed)

  // Keep stdout free of status messages whenever it carries the report itself.
  const log = options.format !== 'summary' && !options.out ? console.error : console.log

  let output

  if (options.format === 'json') {
    output = JSON.stringify({ summary: Object.fromEntries(summarize(dependencies)), dependencies }, null, 2) + '\n'
  } else if (options.format === 'markdown') {
    output = renderMarkdown(dependencies)
  } else if (options.format === 'text') {
    output = renderText(dependencies)
  }

  if (output) {
    if (options.out) {
      writeFileSync(resolve(ROOT, options.out), output)
      log(`Wrote ${dependencies.length} dependencies to ${options.out}`)
    } else {
      process.stdout.write(output)
    }
  } else {
    log(`Checked ${dependencies.length} production dependencies\n`)

    for (const [license, count] of summarize(dependencies)) {
      log(`  ${String(count).padStart(4)}  ${license}`)
    }

    log('')
    printNotable(dependencies, log)
  }

  // Optional dependencies are mostly prebuilt binaries for other platforms, so
  // they are expected to be absent. Missing required ones mean a stale install.
  const missingRequired = graph.missing.filter(dependency => !dependency.optional)
  const missingOptional = graph.missing.length - missingRequired.length

  if (missingOptional > 0) {
    console.warn(`Note: ${missingOptional} optional dependencies are not installed on this platform and were skipped.\n`)
  }

  if (missingRequired.length > 0) {
    console.warn(`Warning: ${missingRequired.length} dependencies could not be resolved, run pnpm install:`)

    for (const { name, requiredBy } of missingRequired) {
      console.warn(`  ${name} (required by ${requiredBy})`)
    }

    console.warn('')
  }

  if (!options.check) {
    return
  }

  const violations = dependencies.filter(dependency => !dependency.allowed)

  if (violations.length > 0) {
    console.error(`Found ${violations.length} dependencies with a disallowed or unknown license:\n`)

    for (const dependency of violations) {
      console.error(`  ${dependency.name}@${dependency.version}: ${dependency.license ?? 'UNKNOWN'}`)
      console.error(`    Platformatic packages: ${dependency.dependents.join(', ') || 'none'}`)

      if (dependency.chain) {
        console.error(`    Pulled in by: ${dependency.chain.join(' -> ')}`)
      }

      if (dependency.violation) {
        console.error(`    Exception does not apply: ${dependency.violation}`)
      }
    }

    console.error(`\nAllowed licenses: ${[...allowed].sort().join(', ')}`)
    console.error('Adding a new license requires a reviewed entry in ADDITIONAL_LICENSES or')
    console.error('PACKAGE_EXCEPTIONS in scripts/license-check.js.')

    process.exitCode = 1
    return
  }

  log('All production dependency licenses are allowed.')
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main()
  } catch (error) {
    console.error(error.message)
    printHelp()
    process.exitCode = 1
  }
}
