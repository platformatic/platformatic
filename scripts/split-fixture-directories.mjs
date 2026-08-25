#!/usr/bin/env node
// Gives each configuration in a crowded fixture directory a directory of its own.
//
//   node scripts/split-fixture-directories.mjs [dirs...]          report, write nothing
//   node scripts/split-fixture-directories.mjs [dirs...] --write  perform the split
//
// v4 allows exactly one watt.config.* per directory — two candidates are a targeted ambiguity
// error, because silently ignoring one of two configurations is never acceptable. A good part of
// this corpus predates that rule: runtime/fixtures/extensions holds thirty-five configurations
// side by side, each named for the test that passes it with --config.
//
// Those cannot be converted in place at all, so they are moved first, while they are still v3 and
// their tests still pass. Conversion is then uniform, and each step is separately verifiable.
//
// Relative paths inside a moved configuration have to move with it. The rule is deliberately
// narrow: a string is rewritten only when it resolves to something that actually exists beside the
// configuration's old home. Guessing which properties are paths would be wrong the first time a
// capability added one.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(import.meta.dirname, '..')
const V3_NAME = /^(watt|platformatic)([.-][a-z0-9-]+)?\.json$/

// Fixtures whose tests resolve sibling files against the runtime root. Splitting moves that root.
const ROOT_RELATIVE_FIXTURES = ['packages/wattpm/test/fixtures/dynamic']

// platformatic-build-twice.json -> build-twice; platformatic.1-to-n.json -> 1-to-n
export function variantName (file) {
  const stem = basename(file).replace(/\.json$/, '')
  const suffix = stem.replace(/^(watt|platformatic)[.-]?/, '')

  return suffix.length > 0 ? suffix : 'default'
}

/*
  Identity, never location. An application id frequently matches the name of its own directory, so
  a rule that asks only "does this string name something on disk" rewrites 'service' into
  '../service' and renames the application. Existence is necessary evidence that a string is a
  path; it is not sufficient.
*/
const NEVER_A_PATH = new Set(['id', 'name', 'module', 'version', 'hostname', 'level', 'type'])

export function rewriteRelativePaths (value, oldDirectory, key) {
  if (typeof value === 'string') {
    if (NEVER_A_PATH.has(key)) {
      return value
    }

    if (value.startsWith('/') || value.startsWith('..')) {
      return value
    }

    // Only a string that names something really present beside the old configuration is a path.
    if (!existsSync(resolve(oldDirectory, value))) {
      return value
    }

    return `../${value.replace(/^\.\//, '')}`
  }

  if (Array.isArray(value)) {
    return value.map(entry => rewriteRelativePaths(entry, oldDirectory, key))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([name, entry]) => [name, rewriteRelativePaths(entry, oldDirectory, name)])
    )
  }

  return value
}

function isRuntimeConfiguration (config, file) {
  if (typeof config.$schema === 'string') {
    return /\/(runtime|wattpm)\//.test(config.$schema)
  }

  return /^(watt|platformatic)(\.runtime)?\.json$/.test(basename(file)) &&
    Boolean(config.applications ?? config.services ?? config.web ?? config.autoload)
}

/*
  Two shapes in this corpus share a directory without being variants of each other, and splitting
  either would be wrong.

  A runtime configuration whose single application lives at the directory root — path '.' with a
  config naming its sibling — is one project, not two. In v4 it becomes a single file using the
  application shorthand, so it merges on conversion rather than splitting now.

  A directory holding only per-application configurations is an application, and its configuration
  belongs beside its code. Two of them are alternatives one test picks between, which v4 cannot
  express in one directory at all — that needs a second application, and which one is a question
  about what the test means.
*/
export function classifyDirectory (directory) {
  const configurations = readdirSync(directory).filter(entry => V3_NAME.test(entry))

  if (configurations.length < 2) {
    return { kind: 'single', configurations }
  }

  const parsed = configurations.map(file => ({
    file,
    config: JSON.parse(readFileSync(join(directory, file), 'utf-8'))
  }))
  const runtimes = parsed.filter(({ file, config }) => isRuntimeConfiguration(config, file))

  if (runtimes.length === 0) {
    return { kind: 'applications-only', configurations }
  }

  /*
    A configuration that autoloads from its own directory turns every sibling directory into an
    application — so giving each variant a directory of its own would quietly add three
    applications named after the variants. The split is not available here at all: the fixture has
    to move its applications, or name them explicitly, before its configurations can move.
  */
  /*
    Some fixtures are driven by tests that operate on files relative to the runtime root — passing
    a sibling data file by name, or writing one there. Moving the configuration moves that root, so
    every such path breaks, and the fixes are not mechanical: they depend on what each test means
    by "the project". Those are listed here rather than guessed at.
  */
  if (ROOT_RELATIVE_FIXTURES.some(fixture => resolve(ROOT, fixture) === resolve(directory))) {
    return { kind: 'root-relative-tests', configurations }
  }

  const autoloadsItsOwnDirectory = parsed.some(({ config }) => {
    const path = config.autoload?.path

    if (typeof path !== 'string') {
      return false
    }

    return resolve(directory, path) === resolve(directory)
  })

  if (autoloadsItsOwnDirectory) {
    return { kind: 'autoloads-itself', configurations }
  }

  if (runtimes.length === 1) {
    const entries = [
      ...(runtimes[0].config.applications ?? []),
      ...(runtimes[0].config.services ?? []),
      ...(runtimes[0].config.web ?? [])
    ]
    const rootedHere = entries.length > 0 && entries.every(entry => !entry.path || entry.path === '.' || entry.path === './')

    if (rootedHere) {
      return { kind: 'runtime-with-root-application', configurations }
    }
  }

  return { kind: 'variants', configurations }
}

export function planSplit (directory) {
  const { kind, configurations } = classifyDirectory(directory)

  if (kind !== 'variants') {
    return []
  }

  return configurations.map(file => {
    const variant = variantName(file)

    return {
      from: join(directory, file),
      // The moved file keeps the generic name: it is now the only configuration in its directory,
      // which is the whole point of moving it.
      to: join(directory, variant, 'platformatic.json'),
      variant
    }
  })
}

function main () {
  const args = process.argv.slice(2)
  const write = args.includes('--write')
  const targets = args.filter(argument => !argument.startsWith('--'))

  if (targets.length === 0) {
    console.error('Name the directories to split.')
    process.exitCode = 1
    return
  }

  let moved = 0
  let rewritten = 0

  for (const target of targets) {
    const directory = resolve(ROOT, target)

    if (!existsSync(directory) || !statSync(directory).isDirectory()) {
      console.error(`${target} is not a directory`)
      process.exitCode = 1
      continue
    }

    const { kind } = classifyDirectory(directory)
    const plan = planSplit(directory)

    if (plan.length === 0) {
      const why = {
        single: 'holds one configuration',
        'runtime-with-root-application': 'is one project with its application at the root; it merges on conversion',
        'applications-only': 'holds alternative application configurations; that needs a second application, not a second directory',
        'autoloads-itself': 'autoloads its own directory, so variant directories would become applications',
        'root-relative-tests': 'its tests resolve sibling files against the runtime root, which the split would move'
      }

      console.log(`${relative(ROOT, directory)}: not split — ${why[kind] ?? kind}`)
      continue
    }

    console.log(`\n${relative(ROOT, directory)} — ${plan.length} configurations`)

    for (const { from, to, variant } of plan) {
      const original = JSON.parse(readFileSync(from, 'utf-8'))
      const adjusted = rewriteRelativePaths(original, directory)
      const changed = JSON.stringify(original) !== JSON.stringify(adjusted)

      console.log(`  ${basename(from)} -> ${variant}/platformatic.json${changed ? '  (paths rewritten)' : ''}`)

      if (changed) {
        rewritten++
      }

      moved++

      if (write) {
        mkdirSync(dirname(to), { recursive: true })
        writeFileSync(to, JSON.stringify(adjusted, null, 2) + '\n', 'utf-8')

        unlinkSync(from)
      }
    }
  }

  console.log(
    `\n${moved} configurations${write ? ' moved' : ' would move'}, ${rewritten} with relative paths rewritten`
  )

  if (!write) {
    console.log('Nothing written; pass --write.')
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
