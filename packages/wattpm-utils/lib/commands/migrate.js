import {
  extractModuleFromSchemaUrl,
  loadConfigurationFile as loadRawConfigurationFile,
  logFatalError,
  parseArgs
} from '@platformatic/foundation'
import { loadConfiguration as loadV4Configuration } from '@platformatic/foundation/lib/v4/index.js'
import { bold } from 'colorette'
import { existsSync, readFileSync } from 'node:fs'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'

/*
  The one-shot codemod from a v3 configuration to a v4 one, and the only code in v4 that reads a
  legacy config at all.

  It is deliberately loud. Where v3 and v4 cannot agree, migrate refuses or reports and never
  guesses — and every refusal is detected before anything is written, so a refused run leaves the
  project exactly as it found it. What it emits imports what it uses, which is why it needs no
  `$schema` stamp: the file identifies itself.

  This is the first slice. It handles a single-application project in the capability dialect whose
  values are literals, and refuses everything else by name rather than converting it partially — a
  half-migrated tree is worse than an unmigrated one, because nothing says which half.
*/

// v3 accepted the recognized names in the directory it ran in. `--config` accepts any filename,
// because `platformatic start -c config.production.yaml` was a supported way to run v3 and a
// candidates-only migrator would report those projects as having nothing to migrate.
const legacyCandidates = [
  'watt.json',
  'watt.yaml',
  'watt.yml',
  'watt.toml',
  'watt.json5',
  'platformatic.json',
  'platformatic.yaml',
  'platformatic.yml',
  'platformatic.toml',
  'platformatic.json5',
  'watt.runtime.json',
  'platformatic.runtime.json',
  'platformatic.application.json',
  'platformatic.service.json',
  'platformatic.db.json',
  'platformatic.composer.json',
  'platformatic.gateway.json'
]

/*
  v3 module names that changed. The identity is read from the `$schema` URL before any upgrade
  chain runs, so what appears here is what the file says rather than what v3 would have rewritten
  it to.
*/
const renamedModules = {
  '@platformatic/composer': '@platformatic/gateway'
}

// The capabilities whose factory this slice knows how to call. A configuration naming anything else
// is refused rather than guessed at: emitting a plain `{ module }` object would produce a file the
// format allows but a migration should never write.
const factories = {
  '@platformatic/astro': 'astro',
  '@platformatic/db': 'db',
  '@platformatic/gateway': 'gateway',
  '@platformatic/nest': 'nest',
  '@platformatic/next': 'next',
  '@platformatic/nitro': 'nitro',
  '@platformatic/node': 'node',
  '@platformatic/nuxt': 'nuxt',
  '@platformatic/react-router': 'reactRouter',
  '@platformatic/remix': 'remix',
  '@platformatic/service': 'service',
  '@platformatic/tanstack': 'tanstack',
  '@platformatic/vite': 'vite'
}

// Everything v3 could put in a value that is not a literal. `{PLT_X}` interpolation does not exist
// in v4, and converting one correctly needs the audited target type for its position — which is
// what tells a number from an enum from a string, and therefore which guard to emit.
const placeholderPattern = /\{[A-Z0-9_]+\}/

export function findLegacyConfiguration (root, named) {
  if (named) {
    const path = resolve(root, named)

    return existsSync(path) ? path : null
  }

  for (const candidate of legacyCandidates) {
    const path = join(root, candidate)

    if (existsSync(path)) {
      return path
    }
  }

  return null
}

function findPlaceholders (value, pointer = '', found = []) {
  if (typeof value === 'string') {
    if (placeholderPattern.test(value)) {
      found.push({ pointer: pointer || '/', value })
    }

    return found
  }

  if (value === null || typeof value !== 'object') {
    return found
  }

  for (const [key, entry] of Object.entries(value)) {
    findPlaceholders(entry, `${pointer}/${key}`, found)
  }

  return found
}

/*
  Every reason this slice will not convert a configuration, gathered before anything is written. The
  two envfile cases are here because they are what a well-formed, ordinary v3 project hits: neither
  has a conversion that preserves what v3 did, so both are a decision for the person who wrote them.
*/
export function collectRefusals (config, { module }) {
  const refusals = []

  if (config.envfile) {
    refusals.push({
      reason: `the root configuration declares ${bold('envfile')}`,
      fix: 'fold that file into the root .env set deliberately, or pass it with --env at run time — converting it would either activate keys v3 never read or copy its contents, often credentials, into a tracked file'
    })
  }

  if (config.autoload) {
    refusals.push({
      reason: `the configuration declares ${bold('autoload')}`,
      fix: 'this migrator does not yet expand autoload: v3 derived those ids from the directory name and v4 prefers the package.json name, so every one that moves needs an autoload.mappings entry pinning it'
    })
  }

  const entries = config.applications ?? config.services ?? config.web

  if (module === '@platformatic/runtime') {
    if (!entries) {
      refusals.push({
        reason: 'the runtime configuration lists no applications',
        fix: 'a runtime with nothing to run has nothing to migrate; add its applications, or migrate each one where it lives'
      })
    }

    return refusals
  }

  if (!module) {
    refusals.push({
      reason: 'the configuration names no capability',
      fix: 'add a $schema URL or a module property naming the capability, then run migrate again'
    })
  } else if (!factories[module]) {
    refusals.push({
      reason: `${bold(module)} is not a capability this migrator knows`,
      fix: 'convert this application by hand — a capability outside the supported set has no factory to call, and emitting a plain { module } object is not something a migration should produce'
    })
  }

  const placeholders = findPlaceholders(config)

  if (placeholders.length > 0) {
    refusals.push({
      reason: `${placeholders.length} value${placeholders.length > 1 ? 's use' : ' uses'} {PLT_X} interpolation (${placeholders
        .slice(0, 3)
        .map(entry => bold(entry.pointer))
        .join(', ')}${placeholders.length > 3 ? ', …' : ''})`,
      fix: 'this migrator does not yet convert interpolated values: each one needs its position\'s audited target type to decide between a string fallback, a number guard and an enum guard'
    })
  }

  return refusals
}

/*
  A value that is already source. `config: next({ … })` is a call inside an object literal, and
  quoting it would emit the text of a call rather than the call.
*/
const rawExpression = Symbol('raw')

function raw (source) {
  return { [rawExpression]: source }
}

function serializeValue (value, indent = 0) {
  const pad = '  '.repeat(indent)
  const inner = '  '.repeat(indent + 1)

  if (value !== null && typeof value === 'object' && value[rawExpression]) {
    return value[rawExpression]
  }

  if (typeof value === 'string') {
    return serializeString(value)
  }

  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]'
    }

    return `[\n${value.map(entry => `${inner}${serializeValue(entry, indent + 1)}`).join(',\n')}\n${pad}]`
  }

  const entries = Object.entries(value)

  if (entries.length === 0) {
    return '{}'
  }

  return `{\n${entries
    .map(([key, entry]) => `${inner}${serializeKey(key)}: ${serializeValue(entry, indent + 1)}`)
    .join(',\n')}\n${pad}}`
}

// Quoted only when it has to be. A migrated file is read by people, and `'cache'` where `cache`
// would do is the kind of thing that makes generated output look generated.
function serializeKey (key) {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : serializeString(key)
}

// Single quotes, because the emitted file lands in a project whose other files use them and a
// migration should not leave a seam showing where it touched.
function serializeString (value) {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`
}

/*
  The id v3 gave a wrapped single-app project: the package.json name with any scope stripped,
  falling back to `main` (`runtime/lib/config.js:135-142`). v4 derives it the same way, so the two
  agree except where the label grammar rejects the name — `my_app` is a legal package name and not a
  legal id. That case is reported rather than silently rewritten, because the id is also the mesh
  hostname, the injected variable, the metrics label and how siblings name it in `dependencies`.
*/
export async function deriveLegacyId (root) {
  let name = 'main'

  try {
    const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf-8'))

    if (packageJson?.name) {
      name = packageJson.name.startsWith('@') ? packageJson.name.split('/')[1] : packageJson.name
    }
  } catch {
    // A missing or unreadable package.json is what the fallback is for.
  }

  const legal = name.replace(/[^a-zA-Z0-9-]/g, '-').replace(/^-+|-+$/g, '') || 'main'

  return { id: legal, renamedFrom: legal === name ? null : name }
}

export function emitApplicationConfiguration (config, { module, id }) {
  const factory = factories[module]
  const { $schema, module: _module, runtime, ...capability } = config

  // Level 1: nothing but capability configuration, so the factory call is the whole file. A
  // defineConfig wrapper around no runtime settings would be ceremony that says nothing.
  if (!runtime) {
    return `import { ${factory} } from '${module}'\n\nexport default ${factory}(${serializeValue(capability)})\n`
  }

  /*
    Level 1b. The runtime block unwraps to the root, except for two keys that move:

    `server` goes into the capability configuration, because v4 has no root server — an application
    declares its own address. `application` becomes the singular shorthand, which is where a
    single-app project's orchestration settings live.
  */
  const { server, application = {}, ...root } = runtime

  if (server) {
    capability.server = { ...server, ...capability.server }
  }

  const shorthand = {
    // Written as a literal so the migrated project depends on neither version's default: v3 derived
    // this from the package.json name and v4 prefers it too, but the two disagree on any name the
    // label grammar rejects.
    id,
    ...application,
    config: raw(`${factory}(${serializeValue(capability, 2)})`)
  }

  return (
    'import { defineConfig } from \'wattpm\'\n' +
    `import { ${factory} } from '${module}'\n\n` +
    `export default defineConfig(${serializeValue({ ...root, application: shorthand })})\n`
  )
}

/*
  A machine writer emitting `.js` into a "type": "commonjs" package writes CommonJS, where
  `export default` is a syntax error. `.mjs` is unambiguous in either, which is what a migration
  wants: the suffix should not depend on a field the user may change later.
*/
export function chooseFileName (root) {
  const manifest = join(root, 'package.json')

  if (existsSync(manifest)) {
    try {
      const { type } = JSON.parse(readFileSync(manifest, 'utf-8'))

      if (type === 'module') {
        return 'watt.config.js'
      }
    } catch {
      // An unreadable package.json is not a reason to fail: .mjs is correct either way.
    }
  }

  return 'watt.config.mjs'
}

/*
  A v3 monorepo becomes a file per application plus a thin root. The root keeps orchestration and
  nothing else: an entry's `config` was a path to the application's own configuration in v3, and in
  v4 that file simply is the application's configuration, so the key has nothing left to name.

  `services` and `web` are both spelled `applications`.
*/
export function emitRootConfiguration (config, entries) {
  const { $schema, module: _module, applications, services, web, ...root } = config

  return (
    "import { defineConfig } from 'wattpm'\n\n" +
    `export default defineConfig(${serializeValue({ ...root, applications: entries })})\n`
  )
}

async function migrateApplications (logger, journal, root, source, config) {
  const declaredEntries = config.applications ?? config.services ?? config.web ?? []
  const emitted = []
  const entries = []
  const skipped = []

  for (const entry of declaredEntries) {
    const { config: _legacyPath, ...orchestration } = entry

    if (!entry.path) {
      // A remote entry has no local configuration to convert, and keeps working as it is.
      entries.push(orchestration)
      continue
    }

    const directory = resolve(root, entry.path)
    const legacy = findLegacyConfiguration(directory, null)

    if (!legacy) {
      /*
        No configuration of its own. v4's detector handles that — it is the zero-config case, not an
        error — so the entry is carried through and the directory is left alone.
      */
      skipped.push(entry.id ?? entry.path)
      entries.push(orchestration)
      continue
    }

    const applicationConfig = await loadRawConfigurationFile(legacy)
    const identity = extractModuleFromSchemaUrl(applicationConfig)
    const declared = applicationConfig.module ?? identity?.module
    const applicationModule = renamedModules[declared] ?? declared
    const refusals = collectRefusals(applicationConfig, { module: applicationModule })

    if (refusals.length > 0) {
      return { refusals, at: legacy }
    }

    const { id } = await deriveLegacyId(directory)
    const target = join(directory, chooseFileName(directory))

    if (existsSync(target)) {
      return { refusals: [{ reason: `${bold(target)} already exists`, fix: 'move it aside and run migrate again' }] }
    }

    await journal.write(target, emitApplicationConfiguration(applicationConfig, { module: applicationModule, id }))
    await journal.remove(legacy)

    // The id is pinned on the entry: v3 took an explicit entry's id from the entry itself, and
    // leaving it out would let v4 derive a different one from the package name.
    entries.push({ ...orchestration, id: entry.id ?? id })
    emitted.push(target)
  }

  return { entries, emitted, skipped }
}

/*
  Every write and delete a run makes, so that a failure anywhere undoes all of them. With one file
  the rollback is obvious; with a file per application plus a root it is the difference between a
  failed migration and a tree that is neither v3 nor v4 with nothing in it saying which files moved.

  Undo runs in reverse, because a later step may depend on an earlier one — the legacy file is
  deleted only after its replacement exists.
*/
function createJournal () {
  const undo = []

  return {
    async write (path, contents) {
      const existed = existsSync(path)
      const previous = existed ? await readFile(path) : null

      await writeFile(path, contents)
      undo.push(() => (existed ? writeFile(path, previous) : rm(path, { force: true })))
    },

    async remove (path) {
      const previous = await readFile(path)

      await rm(path, { force: true })
      undo.push(() => writeFile(path, previous))
    },

    async rollback () {
      for (const step of undo.reverse()) {
        await step()
      }
    }
  }
}

export async function migrateCommand (logger, args) {
  const {
    values: { config: named },
    positionals
  } = parseArgs(
    args,
    {
      config: {
        type: 'string',
        short: 'c'
      }
    },
    false
  )

  const root = resolve(process.cwd(), positionals[0] ?? '')
  const source = findLegacyConfiguration(root, named)

  if (!source) {
    return logFatalError(
      logger,
      `No v3 configuration found in ${bold(root)}. If yours has a name migrate does not recognize, name it with ${bold('--config')}.`
    )
  }

  const config = await loadRawConfigurationFile(source)
  const identity = extractModuleFromSchemaUrl(config)
  const declared = config.module ?? identity?.module
  const module = renamedModules[declared] ?? declared

  const refusals = collectRefusals(config, { module })

  if (refusals.length > 0) {
    logger.error(`Cannot migrate ${bold(source)}:`)

    for (const refusal of refusals) {
      logger.error(`  ${refusal.reason}`)
      logger.error(`    ${refusal.fix}`)
    }

    process.exitCode = 1
    return
  }

  const target = join(dirname(source), chooseFileName(dirname(source)))

  if (existsSync(target)) {
    return logFatalError(
      logger,
      `${bold(basename(target))} already exists in ${bold(dirname(source))}. Migrating would overwrite it.`
    )
  }

  /*
    The swap happens before the validation, and it has to: v4 refuses a directory that still holds
    a legacy file, so validating with the original in place would fail for the one reason that says
    nothing about the emitted file. The original is kept in memory and put back if anything goes
    wrong, which is what makes a failed migration leave the project exactly as it was.
  */
  const journal = createJournal()
  const directory = dirname(source)
  let renamedFrom = null
  let renamedTo = null
  let skipped = []

  if (module === '@platformatic/runtime') {
    const result = await migrateApplications(logger, journal, directory, source, config)

    if (result.refusals) {
      await journal.rollback()
      logger.error(`Cannot migrate ${bold(result.at ?? source)}:`)

      for (const refusal of result.refusals) {
        logger.error(`  ${refusal.reason}`)
        logger.error(`    ${refusal.fix}`)
      }

      process.exitCode = 1
      return
    }

    skipped = result.skipped
    await journal.write(target, emitRootConfiguration(config, result.entries))
  } else {
    const derived = await deriveLegacyId(directory)
    renamedFrom = derived.renamedFrom
    renamedTo = derived.id

    await journal.write(target, emitApplicationConfiguration(config, { module, id: derived.id }))
  }

  await journal.remove(source)

  let unresolved = null

  try {
    await loadV4Configuration({
      cwd: dirname(target),
      configPath: target,
      command: 'start',
      production: true,
      realEnv: { ...process.env },
      // Validated against the capability's own schema, not merely parsed: the emitted file is
      // checked the way a boot would check it, which is the only check that means anything here.
      validateCapabilities: true,
      onWarning () {},
      onInfo () {}
    })
  } catch (error) {
    /*
      A capability that cannot be resolved is a different finding from a configuration that is
      wrong: the emitted file is correct and the dependency is simply not installed, which is the
      normal state of a freshly cloned project. Undoing the migration for that would make migrate
      unusable exactly where it is most needed, so it is reported and the migration stands.
    */
    if (error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'PLT_CAPABILITY_SCHEMA_NOT_FOUND') {
      unresolved = error.message
    } else {
      await journal.rollback()

      return logFatalError(
        logger,
        `The configuration migrate emitted does not load: ${error.message} Nothing was changed — ${bold(basename(source))} is as it was.`
      )
    }
  }

  if (declared !== module) {
    logger.warn(`${bold(declared)} is now ${bold(module)}; the emitted configuration imports the new name.`)
  }

  if (renamedFrom) {
    logger.warn(
      `The application id ${bold(renamedFrom)} is not a legal v4 id and was written as ${bold(renamedTo)}. That name is also the mesh hostname, the injected PLT_*_URL variable, the metrics label and how siblings name it in dependencies — update anything that refers to the old spelling.`
    )
  }

  for (const name of skipped) {
    logger.info(`${bold(name)} has no configuration of its own and was left as it is: v4 infers one from what is in the directory.`)
  }

  if (unresolved) {
    logger.warn(`The emitted configuration was not verified: ${unresolved} Install the project's dependencies and start it to confirm.`)
  }

  logger.done(`Migrated ${bold(basename(source))} to ${bold(basename(target))}.`)
  logger.info('Review the result: no automated check verifies that a converted value still resolves to what v3 resolved.')
}

export const help = {
  migrate: {
    usage: 'migrate [root]',
    description: 'Converts a v3 configuration to the v4 format',
    args: [
      {
        name: 'root',
        description: 'The directory containing the project (the default is the current directory)'
      }
    ],
    options: [
      {
        usage: '-c, --config <config>',
        description: 'The v3 configuration file to migrate, when its name is not one migrate recognizes'
      }
    ]
  }
}
