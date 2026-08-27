#!/usr/bin/env node

/*
  The per-property target-type table the schema audit is meant to produce, and which `migrate` reads
  rather than rediscovering per run.

  Two things come out of one walk over the shipped schemas:

  - **Union sites.** v3's `{PLT_X}` placeholders were strings, so almost every typed property grew a
    `{ type: 'string' }` branch to let one through. v4 has no interpolation, which makes those
    branches dead — but only the ones that exist *for* that reason. A property that is genuinely
    `boolean | object` is a real union and stays. The distinction cannot be made by counting
    branches, so this reports rather than deletes: it is an inventory for the audit to decide from,
    not the decision.

  - **Constraint sets.** migrate intersects a property's constraints across every position a shared
    variable occupies, so it needs each property's full set — enum members, numeric bounds,
    multipleOf, integer-ness, string patterns and lengths — not just its primitive type. A type
    alone cannot decide whether a value satisfying two positions exists.

  Those keywords are exactly migrate's supported subset, so a property whose constraints fall
  outside it (`anyOf` nested deeper than one level, `oneOf`, `not`, `format`) is **flagged**. The
  pre-flight refusal reads the flag instead of rediscovering the limit, which is what keeps the
  audit and the migrator from drifting apart as schemas gain keywords.

  Usage: node scripts/audit-schemas.mjs [--json] [--unions-only]
*/

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const asJson = process.argv.includes('--json')
const unionsOnly = process.argv.includes('--unions-only')

// Everything migrate can intersect. A property carrying anything else cannot be reasoned about
// across positions, which is a refusal rather than a guess.
const supportedKeywords = new Set([
  'type',
  'enum',
  'const',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minLength',
  'maxLength',
  'pattern',
  'default',
  'description',
  'properties',
  'items',
  'required',
  'additionalProperties',
  'propertyNames',
  'anyOf',
  'title',
  '$id',
  '$schema',
  '$ref',
  'definitions',
  'nullable',
  'examples',
  'deprecated',
  'resolvePath',
  'resolveModule',
  'allowEmptyPaths'
])

const unsupportedKeywords = ['oneOf', 'not', 'allOf', 'if', 'then', 'else', 'format']

function collectSchemas () {
  const schemas = []

  for (const entry of readdirSync(join(root, 'packages'), { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }

    const path = join(root, 'packages', entry.name, 'schema.json')

    if (!existsSync(path)) {
      continue
    }

    schemas.push({ package: entry.name, path, schema: JSON.parse(readFileSync(path, 'utf-8')) })
  }

  return schemas.sort((a, b) => a.package.localeCompare(b.package))
}

function constraintsOf (node) {
  const constraints = {}

  for (const key of ['type', 'enum', 'const', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum']) {
    if (key in node) {
      constraints[key] = node[key]
    }
  }

  for (const key of ['multipleOf', 'minLength', 'maxLength', 'pattern']) {
    if (key in node) {
      constraints[key] = node[key]
    }
  }

  return constraints
}

/*
  A branch that exists only to admit a `{PLT_X}` placeholder: a bare string alongside at least one
  non-string branch, carrying no constraints of its own. A string branch that enumerates values, or
  bounds a length, or names a pattern, is describing something real and is left alone.
*/
function looksLikePlaceholderBranch (branches) {
  if (branches.length < 2) {
    return false
  }

  const strings = branches.filter(branch => branch.type === 'string')
  const others = branches.filter(branch => branch.type !== 'string')

  if (strings.length !== 1 || others.length === 0) {
    return false
  }

  return Object.keys(strings[0]).every(key => key === 'type' || key === 'description')
}

/*
  A schema-aware walk. `properties`, `definitions` and `patternProperties` are maps whose *keys* are
  names rather than keywords, so descending into them blindly reports every property in the document
  as an unknown keyword — which is noise that hides the handful of real ones.
*/
const schemaMaps = new Set(['properties', 'definitions', 'patternProperties', 'dependencies'])
const schemaLists = new Set(['anyOf', 'oneOf', 'allOf', 'items', 'prefixItems'])
const schemaValues = new Set(['additionalProperties', 'propertyNames', 'not', 'if', 'then', 'else', 'contains'])

function walk (node, { pointer, packageName, findings }) {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) {
    return
  }

  const unsupported = unsupportedKeywords.filter(keyword => keyword in node)
  const unknown = Object.keys(node).filter(
    key => !supportedKeywords.has(key) && !unsupportedKeywords.includes(key) && !key.startsWith('x-')
  )

  if (Array.isArray(node.anyOf)) {
    const branches = node.anyOf.filter(branch => branch && typeof branch === 'object')

    findings.unions.push({
      package: packageName,
      pointer,
      branches: branches.map(branch => branch.type ?? (branch.enum ? 'enum' : branch.$ref ? '$ref' : 'object')),
      placeholderBranch: looksLikePlaceholderBranch(branches),
      constraints: branches.map(constraintsOf)
    })
  }

  if (unsupported.length > 0 || unknown.length > 0) {
    findings.unsupported.push({ package: packageName, pointer, keywords: [...unsupported, ...unknown].sort() })
  }

  /*
    The table itself: one row per typed position, carrying the whole constraint set rather than the
    primitive type. migrate intersects these across every position a shared variable occupies, and a
    type alone cannot decide whether a value satisfying two positions exists — `port` bounded to
    1..65535 and a `timeout` with a minimum of 1000 admit no common value, which is a refusal migrate
    has to make before it emits anything.
  */
  if ('type' in node || 'enum' in node) {
    const row = findings.table[pointer]
    const supported = unsupported.length === 0 && unknown.length === 0

    if (!row) {
      findings.table[pointer] = {
        pointer,
        packages: [packageName],
        constraints: constraintsOf(node),
        union: Array.isArray(node.anyOf),
        supported
      }
    } else if (!row.packages.includes(packageName)) {
      row.packages.push(packageName)
    }
  }

  for (const [key, value] of Object.entries(node)) {
    if (value === null || typeof value !== 'object') {
      continue
    }

    if (schemaMaps.has(key)) {
      for (const [name, child] of Object.entries(value)) {
        walk(child, { pointer: `${pointer}/${key}/${name}`, packageName, findings })
      }

      continue
    }

    if (schemaLists.has(key)) {
      const entries = Array.isArray(value) ? value : [value]
      entries.forEach((child, index) => {
        walk(child, { pointer: `${pointer}/${key}/${index}`, packageName, findings })
      })

      continue
    }

    if (schemaValues.has(key)) {
      walk(value, { pointer: `${pointer}/${key}`, packageName, findings })
    }
  }
}

/*
  The evidence a reviewer needs to classify a candidate, gathered from the code that *reads* the
  property rather than from the schema, which carries none — `health.maxHeapTotal` has no
  description and is shape-identical to a placeholder union.

  A real string branch has code that converts the string: the `typeof x === 'string' ? parse…(x) : x`
  guard is its signature. A placeholder branch has no such code, because interpolation replaced the
  value before anything read it.

  This reports where it looked and what it found. A distinctive name like `maxHeapTotal` gets a
  confident answer; a generic one like `port` matches lines about other things, and finding nothing
  is not proof of absence. Saying which of the two happened is the point — the tool narrows the
  hand work, it does not replace it.
*/
function collectStringFormEvidence (names) {
  const evidence = new Map(names.map(name => [name, []]))
  const parserCall = /\b(parseMemorySize|parseDuration|parseTime|ms|bytes)\s*\(/

  function scan (directory) {
    let entries

    try {
      entries = readdirSync(directory, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const path = join(directory, entry.name)

      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== 'fixtures') {
          scan(path)
        }

        continue
      }

      if (!entry.name.endsWith('.js')) {
        continue
      }

      const lines = readFileSync(path, 'utf-8').split('\n')

      lines.forEach((line, index) => {
        const guards = line.includes("'string'") && line.includes('typeof')
        const parses = parserCall.test(line)

        if (!guards && !parses) {
          return
        }

        for (const name of names) {
          if (line.includes(name) && evidence.get(name).length < 3) {
            evidence.get(name).push(`${path.slice(root.length + 1)}:${index + 1}`)
          }
        }
      })
    }
  }

  for (const entry of readdirSync(join(root, 'packages'), { withFileTypes: true })) {
    if (entry.isDirectory()) {
      scan(join(root, 'packages', entry.name, 'lib'))
    }
  }

  return evidence
}

function main () {
  const findings = { table: {}, unions: [], unsupported: [] }

  for (const { package: packageName, schema } of collectSchemas()) {
    walk(schema, { pointer: '', packageName, findings })
  }

  const placeholders = findings.unions.filter(union => union.placeholderBranch)
  const real = findings.unions.filter(union => !union.placeholderBranch)

  const candidateNames = [...new Set(placeholders.map(union => union.pointer.split('/').pop()))].filter(
    name => name && !/^\d+$/.test(name)
  )

  const evidence = collectStringFormEvidence(candidateNames)
  const withEvidence = candidateNames.filter(name => evidence.get(name).length > 0)

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          table: Object.values(findings.table).sort((a, b) => a.pointer.localeCompare(b.pointer)),
          unions: findings.unions.map(union => {
            const name = union.pointer.split('/').pop()
            return union.placeholderBranch ? { ...union, stringFormEvidence: evidence.get(name) ?? [] } : union
          }),
          unsupported: findings.unsupported
        },
        null,
        2
      )
    )

    return
  }


  /*
    Every capability schema embeds the shared blocks, so the same site appears once per package.
    What the audit has to classify is the distinct set: fixing `server.port` fixes it everywhere,
    and counting the copies would make the work look an order of magnitude larger than it is.
  */
  const distinct = new Set(findings.unions.map(union => union.pointer))
  const distinctPlaceholders = new Set(placeholders.map(union => union.pointer))
  const distinctReal = new Set(real.map(union => union.pointer))

  console.log(`typed positions: ${Object.keys(findings.table).length} distinct`)
  console.log(`  outside the supported keyword subset: ${Object.values(findings.table).filter(row => !row.supported).length}`)
  console.log(`\nunion sites: ${distinct.size} distinct (${findings.unions.length} across all packages)`)
  console.log(
    `  placeholder-shaped (a bare string branch beside a typed one): ${distinctPlaceholders.size} distinct (${placeholders.length})`
  )
  console.log(`  genuine unions to classify by hand: ${distinctReal.size} distinct (${real.length})`)
  console.log(
    `\ncandidates whose string form is parsed somewhere — a real branch, not a placeholder: ${withEvidence.length}`
  )

  for (const name of withEvidence.slice(0, 12)) {
    console.log(`  ${name.padEnd(22)} ${evidence.get(name).join(', ')}`)
  }

  if (withEvidence.length > 12) {
    console.log(`  … and ${withEvidence.length - 12} more (use --json for the full set)`)
  }

  const byPackage = {}

  for (const union of placeholders) {
    byPackage[union.package] = (byPackage[union.package] ?? 0) + 1
  }

  console.log('\nplaceholder-shaped by package:')

  for (const [packageName, count] of Object.entries(byPackage).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${packageName.padEnd(16)} ${count}`)
  }

  if (!unionsOnly) {
      const distinctUnsupported = new Map()

    for (const entry of findings.unsupported) {
      if (!distinctUnsupported.has(entry.pointer)) {
        distinctUnsupported.set(entry.pointer, entry)
      }
    }

    console.log(
      `\nproperties outside migrate's supported keyword subset: ${distinctUnsupported.size} distinct (${findings.unsupported.length})`
    )

    for (const entry of [...distinctUnsupported.values()].slice(0, 20)) {
      console.log(`  ${entry.pointer}: ${entry.keywords.join(', ')}`)
    }

    if (distinctUnsupported.size > 20) {
      console.log(`  … and ${distinctUnsupported.size - 20} more (use --json for the full set)`)
    }
  }
}

main()
