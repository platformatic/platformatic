#!/usr/bin/env node
// Converts the in-tree v3 JSON configuration fixtures to the v4 code form.
//
//   node scripts/convert-fixtures.mjs [paths...]     report coverage and refusals, write nothing
//   node scripts/convert-fixtures.mjs --write        write watt.config.js beside each conversion
//   node scripts/convert-fixtures.mjs --write --delete   …and remove the v3 file it replaced
//
// Reporting is the default and writing is opt-in, deliberately. A tool whose whole job is
// rewriting hundreds of files in place should make the safe thing the thing that happens when you
// get the invocation wrong.
//
// This is not `migrate`. Migrate converts configurations it has never seen, under a preflight that
// refuses anything it cannot carry faithfully, and it has to be right about other people's
// projects. This converts a known corpus that lives in this repository, where a bad conversion
// shows up as a failing test rather than as a broken deployment — so it refuses less and reports
// more, and every refusal is a fixture somebody looks at by hand.

import { readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(import.meta.dirname, '..')

// v3 interpolation: {X} and {{X}} alike, the pattern the v3 loader used.
const INTERPOLATION = /\{\{?([A-Za-z0-9_]+)\}?\}/g

// Properties whose schema type is a number, so an interpolated value has to be coerced explicitly:
// v4 turns AJV coercion off, and a string where the schema says number is a validation failure
// rather than a silent conversion.
const NUMERIC_PROPERTIES = new Set([
  'port',
  'timeout',
  'maxTTL',
  'ttl',
  'backlog',
  'workers',
  'restartOnError',
  'gracePeriod',
  'startTimeout',
  'maxAttempts',
  'statusCode',
  'maxTotalWorkers',
  'minWorkers',
  'maxWorkers'
])

class Expression {
  constructor (source) {
    this.source = source
  }
}

// A whole-string placeholder becomes the variable itself; an embedded one becomes a template
// literal, because that is the only form that keeps the surrounding text.
function convertString (value, key) {
  INTERPOLATION.lastIndex = 0

  if (!INTERPOLATION.test(value)) {
    return value
  }

  INTERPOLATION.lastIndex = 0
  const whole = value.match(/^\{\{?([A-Za-z0-9_]+)\}?\}$/)

  if (whole) {
    const read = `process.env.${whole[1]}`

    return new Expression(NUMERIC_PROPERTIES.has(key) ? `Number(${read})` : read)
  }

  const template = value.replace(INTERPOLATION, (_, name) => `\${process.env.${name}}`)

  return new Expression('`' + template + '`')
}

function convertValue (value, key) {
  if (typeof value === 'string') {
    return convertString(value, key)
  }

  if (Array.isArray(value)) {
    return value.map(entry => convertValue(entry, key))
  }

  if (value && typeof value === 'object') {
    const converted = {}

    for (const [name, entry] of Object.entries(value)) {
      converted[name] = convertValue(entry, name)
    }

    return converted
  }

  return value
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/

export function toSource (value, indent = 0) {
  const pad = '  '.repeat(indent)
  const inner = '  '.repeat(indent + 1)

  if (value instanceof Expression) {
    return value.source
  }

  if (typeof value === 'string') {
    // Single quotes, to match the style of every other source file in this repository.
    return value.includes("'") ? JSON.stringify(value) : `'${value}'`
  }

  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]'
    }

    return `[\n${value.map(entry => inner + toSource(entry, indent + 1)).join(',\n')}\n${pad}]`
  }

  const entries = Object.entries(value).filter(([, entry]) => entry !== undefined)

  if (entries.length === 0) {
    return '{}'
  }

  const body = entries
    .map(([key, entry]) => `${inner}${IDENTIFIER.test(key) ? key : JSON.stringify(key)}: ${toSource(entry, indent + 1)}`)
    .join(',\n')

  return `{\n${body}\n${pad}}`
}

// v3 encoded the capability in the filename as well as in $schema, and a good part of this corpus
// predates $schema entirely — platformatic.service.json says what it is without saying it twice.
const SUFFIX_MODULES = {
  service: '@platformatic/service',
  db: '@platformatic/db',
  gateway: '@platformatic/gateway',
  composer: '@platformatic/gateway',
  runtime: '@platformatic/runtime',
  application: '@platformatic/node'
}

/*
  A v4 configuration is an ES module, so the extension has to agree with the package it lands in:
  .js only where the nearest package.json says "type": "module", and .mjs everywhere else. Most of
  this corpus is CommonJS or declares nothing at all, where export default is a syntax error.

  This is the same rule scaffolding and migrate follow, one extension down: they choose between
  .ts and .mts for the same reason.
*/
export function configurationFilenameFor (directory) {
  let current = resolve(directory)

  while (true) {
    try {
      const manifest = JSON.parse(readFileSync(join(current, 'package.json'), 'utf-8'))

      return manifest.type === 'module' ? 'watt.config.js' : 'watt.config.mjs'
    } catch {
      // Keep walking: a fixture's own directory often has no manifest of its own.
    }

    const parent = dirname(current)

    if (parent === current) {
      return 'watt.config.mjs'
    }

    current = parent
  }
}

function moduleFromFilename (file) {
  const match = basename(file ?? '').match(/^(?:watt|platformatic)\.([a-z]+)\.json$/)

  return match ? (SUFFIX_MODULES[match[1]] ?? null) : null
}

function moduleFromSchema (config, file) {
  if (typeof config.module === 'string') {
    return config.module
  }

  const url = config.$schema

  if (typeof url !== 'string') {
    return moduleFromFilename(file)
  }

  const match = url.match(/schemas\.platformatic\.dev\/(?:@platformatic\/)?([a-z-]+)\//)

  if (!match) {
    return moduleFromFilename(file)
  }

  const name = match[1]

  return name === 'wattpm' ? '@platformatic/runtime' : `@platformatic/${name}`
}

export function convert (config, { file } = {}) {
  const refusals = []
  const notes = []
  const module = moduleFromSchema(config, file)
  const isRuntime = module === '@platformatic/runtime'

  const { $schema, module: _module, ...rest } = config
  const converted = convertValue(rest)

  if (isRuntime) {
    // v4 has one spelling. services and web were the v3 aliases, and the runtime transform merged
    // all three; the merge is what leaves with them.
    const applications = [
      ...(converted.applications ?? []),
      ...(converted.services ?? []),
      ...(converted.web ?? [])
    ]

    delete converted.services
    delete converted.web

    if (applications.length > 0) {
      converted.applications = applications
    }

    if (converted.entrypoint) {
      // No fixture in this corpus has one, but a converter that silently dropped it would be wrong
      // the first time one appeared.
      refusals.push('declares an entrypoint, which v4 removes: the port belongs to the application')
      delete converted.entrypoint
    }

    if (converted.server) {
      // v4 has no runtime-level listener. Which application should own the port is a judgement
      // about what the fixture is testing, so it is reported rather than guessed.
      refusals.push('declares a root server block, which v4 removes: move the port into the application that served it')
      delete converted.server
    }

    if (converted.runtime) {
      refusals.push('carries a wrapped runtime block, which v4 flattens to the top level')
    }

    for (const entry of converted.applications ?? []) {
      if (typeof entry.config === 'string') {
        // v4 discovers a per-application file by directory rather than by a path in the entry, so
        // the referenced file becomes that directory's own watt.config.js.
        notes.push(`entry '${entry.id ?? '?'}' referenced ${entry.config}; convert that file in place`)
        delete entry.config
      }
    }
  } else if (module) {
    // module is the discriminator classification rule 2 reads, so it leads.
    return {
      module,
      isRuntime,
      refusals,
      notes,
      source: `// Converted from v3 JSON by scripts/convert-fixtures.mjs\nexport default ${toSource({ module, ...converted })}\n`,
      file
    }
  } else {
    refusals.push('has no module and no recognizable $schema, so its capability cannot be determined')
  }

  const header = '// Converted from v3 JSON by scripts/convert-fixtures.mjs\n'

  return {
    module,
    isRuntime,
    refusals,
    notes,
    source: `${header}export default ${toSource(converted)}\n`,
    file
  }
}

const V3_NAME = /^(watt|platformatic)([.-][a-z0-9-]+)?\.json$/

function collect (target) {
  const stats = statSync(target)

  if (stats.isFile()) {
    return [target]
  }

  const found = []

  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
      continue
    }

    const path = join(target, entry.name)

    if (entry.isDirectory()) {
      found.push(...collect(path))
    } else if (V3_NAME.test(entry.name)) {
      found.push(path)
    }
  }

  return found
}

function main () {
    const args = process.argv.slice(2)
  const write = args.includes('--write')
  const dryRun = !write
  const keep = !args.includes('--delete')
  const targets = args.filter(argument => !argument.startsWith('--'))
  const files = (targets.length > 0 ? targets : [join(ROOT, 'packages')]).flatMap(target =>
    collect(resolve(ROOT, target))
  )

  let converted = 0
  const refused = []
  const noted = []

  /*
    v4 allows exactly one watt.config.* per directory — two candidates are a targeted ambiguity
    error, because silently ignoring one of two configurations is never acceptable. A good part of
    this corpus predates that rule: runtime/fixtures/extensions alone holds thirty-five configurations
    side by side, each named for the test that passes it with --config.

    Those cannot be converted in place at all. They need one directory each, which is a change to the
    tests that name them as much as to the fixtures, so the converter reports them and writes
    nothing.
  */
  const byDirectory = new Map()

  for (const file of files) {
    const directory = dirname(file)
    byDirectory.set(directory, [...(byDirectory.get(directory) ?? []), file])
  }

  const crowded = [...byDirectory].filter(([, group]) => group.length > 1)
  const crowdedFiles = new Set(crowded.flatMap(([, group]) => group))

  for (const file of files) {
    if (crowdedFiles.has(file)) {
      continue
    }

    let config

    try {
      config = JSON.parse(readFileSync(file, 'utf-8'))
    } catch (error) {
      refused.push([file, `is not valid JSON: ${error.message}`])
      continue
    }

    const result = convert(config, { file })

    if (result.refusals.length > 0) {
      refused.push([file, result.refusals.join('; ')])
      continue
    }

    for (const note of result.notes) {
      noted.push([file, note])
    }

    converted++

    if (!dryRun) {
        writeFileSync(join(dirname(file), configurationFilenameFor(dirname(file))), result.source, 'utf-8')

      if (!keep) {
        unlinkSync(file)
      }
    }
  }

  const show = path => relative(ROOT, path)

  console.log(`${files.length} v3 configurations found`)
  console.log(`${converted} convert cleanly${dryRun ? ' (nothing written; pass --write)' : ''}`)

  if (crowded.length > 0) {
    console.log(
      `\n${crowdedFiles.size} in ${crowded.length} directories that hold more than one configuration,` +
        ' which v4 forbids — each needs its own directory:'
    )

    for (const [directory, group] of crowded.sort((a, b) => b[1].length - a[1].length).slice(0, 6)) {
      console.log(`  ${group.length.toString().padStart(3)}  ${show(directory)}`)
    }
  }

  if (noted.length > 0) {
    console.log(`\n${noted.length} converted with a follow-up:`)
    for (const [file, note] of noted.slice(0, 20)) {
      console.log(`  ${show(file)}: ${note}`)
    }
    if (noted.length > 20) {
      console.log(`  … and ${noted.length - 20} more`)
    }
  }

  if (refused.length > 0) {
    console.log(`\n${refused.length} need a human:`)
    const grouped = new Map()
    for (const [file, reason] of refused) {
      grouped.set(reason, [...(grouped.get(reason) ?? []), file])
    }
    for (const [reason, group] of [...grouped].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`  ${group.length.toString().padStart(4)}  ${reason}`)
      for (const file of group.slice(0, 3)) {
        console.log(`        ${show(file)}`)
      }
    }
  }

  process.exitCode = refused.length > 0 && !dryRun ? 1 : 0
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
