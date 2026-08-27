import {
  extractModuleFromSchemaUrl,
  loadConfigurationFile as loadRawConfigurationFile,
  logFatalError,
  parseArgs
} from '@platformatic/foundation'
import { loadConfiguration as loadV4Configuration } from '@platformatic/foundation/lib/v4/index.js'
import { loadConfiguration as loadV4Runtime } from '@platformatic/runtime'
import { bold } from 'colorette'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'

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

/*
  The four names v4 recognizes. A directory already holding one has a configuration, and a second
  beside it is two candidates in one directory -- which the loader rejects. So a `watt.config.js`
  where migrate would write `watt.config.mjs` is not a free pass; it is a reason to stop.
*/
const v4Candidates = ['watt.config.ts', 'watt.config.mts', 'watt.config.js', 'watt.config.mjs']

/*
  The nearest existing ancestor, canonicalized, with the missing segments put back. Several of the
  paths this is asked about legitimately do not exist yet and `realpath` throws on a missing one, so
  requiring it of the path itself would abort an ordinary migration with a filesystem error. Where
  the path does exist this is a plain realpath, which is the case it was written for: a symlinked
  directory is how a path that looks inside the tree points outside it.
*/
function canonicalize (path) {
  const missing = []
  let current = resolve(path)

  while (!existsSync(current)) {
    const parent = dirname(current)

    if (parent === current) {
      return current
    }

    missing.unshift(basename(current))
    current = parent
  }

  return join(realpathSync(current), ...missing)
}

// Compared as paths and not as strings, because a prefix match admits `/tmp/app-evil` as contained
// by `/tmp/app`.
function contains (root, path) {
  const inside = relative(canonicalize(root), canonicalize(path))

  return inside === '' || (!inside.startsWith('..') && !isAbsolute(inside))
}

// v3 imposed no grammar on ids; v4 requires a DNS label. The rewrite is mechanical, which is what
// makes the collision it can cause mechanical too -- and computable before anything is written.
function legalId (id) {
  return id.replace(/[^a-zA-Z0-9-]/g, '-').replace(/^-+|-+$/g, '')
}

function existingV4Candidate (directory) {
  return v4Candidates.find(candidate => existsSync(join(directory, candidate))) ?? null
}

/*
  The id an autoloaded directory has under each version.

  v3 used the directory name alone -- `mapping.id ?? entry.name` (`runtime/lib/config.js:463`) --
  and v4 prefers the scope-stripped `package.json` name, falling back to the directory.

  `v3` is put through the label rule and `v4` is not, because that is the comparison the pin has to
  answer: v4 uses its raw derivation and refuses it outright when it is not a legal label. Comparing
  two normalized values instead would call `legacy_api` a match -- both sides derive that same raw
  string -- and emit a configuration whose id the label grammar rejects, which is the one case a
  raw comparison passes over in silence.
*/
async function autoloadedIds (directory, mapping) {
  const name = basename(directory)
  let packageName

  try {
    packageName = JSON.parse(await readFile(join(directory, 'package.json'), 'utf-8'))?.name
  } catch {
    // A directory need not have a package.json, and the derivation falls through to its name.
  }

  return {
    v3: legalId(mapping.id ?? name),
    v4: mapping.id ?? (packageName ? stripScope(packageName) : name)
  }
}

function stripScope (name) {
  return name.startsWith('@') ? name.split('/')[1] : name
}

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

  const entries = config.applications ?? config.services ?? config.web

  if (module === '@platformatic/runtime') {
    // An autoload-only runtime lists nothing and still has applications: they come from the
    // directory rather than from the file.
    if (!entries && !config.autoload) {
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
      name = stripScope(packageJson.name)
    }
  } catch {
    // A missing or unreadable package.json is what the fallback is for.
  }

  const legal = legalId(name) || 'main'

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
export function emitRootConfiguration (config, entries, inlined = [], autoload = null) {
  const { $schema, module: _module, applications, services, web, ...root } = config

  if (autoload) {
    // Carries the pins migrate computed, which is the whole of what autoload gains in v4.
    root.autoload = autoload
  }

  // A root-inline entry calls its factory in this file, so the file has to import it. Sorted and
  // deduplicated because two inline entries may share a capability.
  const imports = ["import { defineConfig } from 'wattpm'"]

  for (const module of [...new Set(inlined)].sort()) {
    imports.push(`import { ${factories[module]} } from '${module}'`)
  }

  return `${imports.join('\n')}\n\nexport default defineConfig(${serializeValue({ ...root, applications: entries })})\n`
}

/*
  What the run would do, worked out before it does any of it. Every refusal lives here, over the
  parsed configuration and the filesystem as it stands, so that "stops before modifying any file" is
  a property of the shape of the code rather than a promise each new check has to remember to keep.

  It is also where the emitted root entry is assembled: an id pinned to what v3 resolved, and an
  `envfile` rebased, are decisions about output that need the same lexical view the refusals need.
*/
export async function planMigration (root, source, config) {
  const refusals = []
  const applications = []
  const skipped = []
  const declaredEntries = config.applications ?? config.services ?? config.web ?? []
  const rootDirectory = canonicalize(dirname(source))

  for (const entry of declaredEntries) {
    const { config: _legacyPath, envfile, ...orchestration } = entry
    const named = entry.id ?? entry.path ?? entry.url ?? 'an application'

    if (!entry.path) {
      // Orchestration only: an entry with a `url` and no resolvable directory has nothing local to
      // convert, and is another repository's project to migrate.
      applications.push({ orchestration: entry })
      continue
    }

    const directory = resolve(root, entry.path)

    /*
      The transaction root is the tree one dirty check, one lockfile and one install cover. An
      application at `../shared/api` may sit in another workspace or another repository: migrate
      would write a configuration there, delete its legacy file, and hold a rollback that cannot
      reach it. The format supports the layout; one run declines to transact two trees.
    */
    if (!contains(root, directory)) {
      refusals.push({
        reason: `${bold(named)} resolves to ${bold(entry.path)}, outside this project`,
        fix: 'migrate that project on its own, then run migrate here again — one run cannot transact two independent trees'
      })
      continue
    }

    /*
      v3 resolved an entry's `envfile` against the runtime root (`runtime/lib/worker/main.js:237`)
      and v4 resolves it against the application's own directory, so the path is rebased to keep
      naming the same file.
    */
    let rebased = null

    if (envfile) {
      const declaredFile = resolve(root, envfile)

      if (!existsSync(declaredFile)) {
        /*
          v3 read an application's env file inside a try/catch and carried on when it was not there;
          v4 makes an explicitly named missing file a load error. Both are defensible and the
          combination is not, because it converts a working project into one that refuses to load.
        */
        refusals.push({
          reason: `${bold(named)} declares ${bold('envfile')} ${bold(envfile)}, which does not exist`,
          fix: `create the file that declaration meant, or drop it — dropping it is not a no-op, because .env, .env.local, .env.<mode> and .env.<mode>.local in ${entry.path} then take over from it`
        })
        continue
      }

      rebased = relative(directory, declaredFile)
    }

    /*
      An application in the root configuration's own directory is emitted root-inline: the per-app
      style would put two v4 candidates in one directory, which the loader rejects. Its capability
      configuration becomes the entry's `config`, which is resolvable by definition — its
      dependencies live at that root.
    */
    const inline = canonicalize(directory) === rootDirectory

    if (inline && envfile) {
      // An inline entry has no eval worker of its own, so an envfile beside it has nothing to
      // apply it -- which is why the two cannot be spelled together.
      refusals.push({
        reason: `${bold(named)} lives in the root configuration's own directory and declares ${bold('envfile')}`,
        fix: 'move the application into a subdirectory, or fold the named file into its own .env set — an application emitted root-inline has no eval worker of its own, so an envfile beside an inline config has nothing to apply it'
      })
      continue
    }

    /*
      An entry's `config` names its own file and v3 resolved it against the application's path
      (`runtime/lib/config.js:270-271`), which is how one directory could hold two applications.
      Ignoring it would make migrate read the wrong file, or none.
    */
    let legacy = null

    if (entry.config) {
      legacy = resolve(directory, entry.config)

      if (!existsSync(legacy)) {
        refusals.push({
          reason: `${bold(named)} names the configuration ${bold(entry.config)}, which does not exist`,
          fix: 'point the entry at the file it means, or drop the key and let migrate find the configuration in that directory'
        })
        continue
      }

      /*
        An application inside the root may legally point at `../../shared/platformatic.json` — a file
        migrate reads to classify it and deletes once it is converted, on a tree its rollback cannot
        reach. That is worse than writing outside the root, because a write at least leaves the
        original behind.
      */
      if (!contains(root, legacy)) {
        refusals.push({
          reason: `${bold(named)} reads ${bold(entry.config)}, outside this project`,
          fix: 'move that configuration into this project, or migrate the project it belongs to on its own — migrate will not delete a file its rollback cannot restore'
        })
        continue
      }
    } else if (!inline) {
      // The root's own legacy file is the runtime configuration and not this application's, so an
      // inline entry has a configuration only where the entry names one.
      legacy = findLegacyConfiguration(directory, null)
    }

    if (!legacy) {
      /*
        No configuration of its own. v4's detector handles that — it is the zero-config case, not an
        error — so the entry is carried through and the directory is left alone.
      */
      skipped.push(named)
      applications.push({ orchestration: envfile ? { ...orchestration, envfile: rebased } : orchestration })
      continue
    }

    const applicationConfig = await loadRawConfigurationFile(legacy)
    const identity = extractModuleFromSchemaUrl(applicationConfig)
    const declared = applicationConfig.module ?? identity?.module
    const module = renamedModules[declared] ?? declared

    for (const refusal of collectRefusals(applicationConfig, { module })) {
      refusals.push({ ...refusal, reason: `${refusal.reason} (${bold(relative(root, legacy))})` })
    }

    const derived = await deriveLegacyId(directory)
    const id = entry.id ? legalId(entry.id) : derived.id

    // The id is pinned on the entry: v3 took an explicit entry's id from the entry itself, and
    // leaving it out would let v4 derive a different one from the package name.
    const settled = { ...orchestration, id, ...(envfile ? { envfile: rebased } : {}) }

    if (inline) {
      const { $schema: _schema, module: _declared, ...capability } = applicationConfig

      settled.config = raw(`${factories[module]}(${serializeValue(capability, 3)})`)
    }

    applications.push({
      config: applicationConfig,
      declared,
      directory,
      inline,
      legacy,
      module,
      orchestration: settled,
      renamedFrom: entry.id && id !== entry.id ? entry.id : entry.id ? null : derived.renamedFrom,
      target: inline ? null : join(directory, chooseFileName(directory))
    })
  }

  const autoload = await planAutoload(root, config, applications, refusals, skipped)

  return {
    applications,
    autoload,
    refusals: refusals.concat(collectPlanRefusals(root, source, applications)),
    skipped
  }
}

/*
  Autoload survives migration as autoload: the root stays thin, and what migrate adds is a mapping
  pinning `id` wherever the legal v4 id differs from the id v3 used. Not wherever the raw values
  differ, which is the comparison that leaks -- a directory named `my_app` derives the same raw
  value under both versions, and still has to be pinned, because the legal v4 id is `my-app` and
  keeping the v3 spelling would emit a configuration the label grammar rejects.

  The directories themselves are converted like any other application: each one that has a
  configuration of its own gets a v4 file in its place.
*/
async function planAutoload (root, config, applications, refusals, skipped) {
  if (!config.autoload) {
    return null
  }

  const { exclude = [], mappings = {}, path } = config.autoload
  const directory = resolve(root, path)

  if (!contains(root, directory)) {
    refusals.push({
      reason: `${bold('autoload.path')} resolves to ${bold(path)}, outside this project`,
      fix: 'migrate that project on its own, then run migrate here again — one run cannot transact two independent trees'
    })

    return null
  }

  if (!existsSync(directory)) {
    // A structural position that resolves to nothing: v4 needs a real directory to expand, and
    // there is nothing here to guess at.
    refusals.push({
      reason: `${bold('autoload.path')} names ${bold(path)}, which does not exist`,
      fix: 'point autoload.path at the directory holding the applications, or drop it and list them explicitly'
    })

    return null
  }

  // The explicit entries win over an autoloaded directory of the same path, exactly as they did in
  // v3 -- so a directory one of them already claims is not converted twice.
  const claimed = new Set(applications.filter(entry => entry.directory).map(entry => canonicalize(entry.directory)))
  const pinned = { ...mappings }

  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (!entry.isDirectory() || exclude.includes(entry.name)) {
      continue
    }

    const applicationRoot = join(directory, entry.name)

    if (claimed.has(canonicalize(applicationRoot))) {
      continue
    }

    const mapping = mappings[entry.name] ?? {}
    const { v3, v4 } = await autoloadedIds(applicationRoot, mapping)

    if (v3 !== v4) {
      /*
        The id is the mesh hostname, the injected PLT_*_URL variable, the metrics label and how
        siblings name it in `dependencies`. Letting v4 re-derive it would move all four at once.

        A mapping that already carries an id is v3's answer either way, and reaches this only when
        the label rule had to change it.
      */
      pinned[entry.name] = { ...mapping, id: v3 }
    }

    const legacy = mapping.config
      ? resolve(applicationRoot, mapping.config)
      : findLegacyConfiguration(applicationRoot, null)

    if (!legacy || !existsSync(legacy)) {
      skipped.push(v3)
      continue
    }

    const applicationConfig = await loadRawConfigurationFile(legacy)
    const identity = extractModuleFromSchemaUrl(applicationConfig)
    const declared = applicationConfig.module ?? identity?.module
    const module = renamedModules[declared] ?? declared

    for (const refusal of collectRefusals(applicationConfig, { module })) {
      refusals.push({ ...refusal, reason: `${refusal.reason} (${bold(relative(root, legacy))})` })
    }

    applications.push({
      autoloaded: true,
      config: applicationConfig,
      declared,
      directory: applicationRoot,
      legacy,
      module,
      orchestration: { id: v3 },
      renamedFrom: null,
      target: join(applicationRoot, chooseFileName(applicationRoot))
    })
  }

  return { ...config.autoload, ...(Object.keys(pinned).length > 0 ? { mappings: pinned } : {}) }
}

/*
  The refusals that are about the plan as a whole rather than about any one entry: what the run
  would overwrite, what it would write twice, and which ids stop being distinct once the label rule
  has been applied to them.
*/
function collectPlanRefusals (root, source, applications) {
  const refusals = []
  const producers = new Map()
  const ids = new Map()

  for (const application of applications) {
    if (application.target) {
      /*
        v3 let two entries with distinct ids share a directory, because each named its own config
        file. v4 has one configuration per directory, so both emit the same path and the second write
        replaces the first. Neither target exists yet, which is why this is a question about the plan
        and not about the filesystem.
      */
      const claimed = producers.get(canonicalize(application.target))

      if (claimed) {
        refusals.push({
          reason: `${bold(claimed)} and ${bold(application.orchestration.id)} would both be written to ${bold(relative(root, application.target))}`,
          fix: 'two v3 applications sharing a directory are two applications, and v4 keeps one configuration per directory — give each its own directory'
        })
      } else {
        producers.set(canonicalize(application.target), application.orchestration.id)
      }

      const existing = existingV4Candidate(application.directory)

      if (existing) {
        refusals.push({
          reason: `${bold(join(relative(root, application.directory), existing))} already exists`,
          fix: 'move it aside and run migrate again — migrating on top of it would overwrite a file git may never have seen, and a second candidate beside it is a directory the loader refuses'
        })
      }
    }

    const id = application.orchestration.id

    if (!id) {
      continue
    }

    // DNS labels are case-insensitive, so `API` and `api` are one id.
    const key = id.toLowerCase()
    const claimed = ids.get(key)

    if (claimed && claimed !== application.orchestration) {
      refusals.push({
        reason: `two applications resolve to the id ${bold(id)}`,
        fix: 'give one of them an explicit id — an id is the mesh hostname, the injected PLT_*_URL variable and the metrics label, so this is the one thing migrate must not pick on your behalf'
      })
    } else {
      ids.set(key, application.orchestration)
    }
  }

  const existing = existingV4Candidate(dirname(source))

  if (existing) {
    refusals.push({
      reason: `${bold(existing)} already exists in ${bold(dirname(source))}`,
      fix: 'move it aside and run migrate again — migrating would overwrite it'
    })
  }

  return refusals
}

async function emitApplications (journal, applications) {
  const entries = []
  const emitted = []
  const inlined = []

  for (const application of applications) {
    if (application.inline) {
      /*
        Its configuration now lives in the root file, so the file it came from goes -- leaving it
        would put a legacy configuration beside a v4 one, which the loader refuses.
      */
      if (application.legacy) {
        await journal.remove(application.legacy)
        inlined.push(application.module)
      }

      entries.push(application.orchestration)
      continue
    }

    if (!application.target) {
      entries.push(application.orchestration)
      continue
    }

    if (application.autoloaded) {
      /*
        An autoloaded directory is not an entry and does not become one: it keeps being discovered,
        and what it needs from migrate is its own configuration file in v4 spelling.
      */
      await journal.write(
        application.target,
        emitApplicationConfiguration(application.config, {
          module: application.module,
          id: application.orchestration.id
        })
      )
      await journal.remove(application.legacy)
      emitted.push(application)
      continue
    }

    await journal.write(
      application.target,
      emitApplicationConfiguration(application.config, {
        module: application.module,
        id: application.orchestration.id
      })
    )
    await journal.remove(application.legacy)

    entries.push(application.orchestration)
    emitted.push(application)
  }

  return { entries, emitted, inlined }
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

  const directory = dirname(source)
  const target = join(directory, chooseFileName(directory))
  const runtime = module === '@platformatic/runtime'

  /*
    Everything that can stop the run is worked out here, over the configuration and the tree as they
    stand. A refused run has written nothing, so there is nothing for it to undo.
  */
  const refusals = collectRefusals(config, { module })
  let plan = null

  if (runtime && refusals.length === 0) {
    plan = await planMigration(directory, source, config)
    refusals.push(...plan.refusals)
  } else if (!runtime && existsSync(target)) {
    refusals.push({
      reason: `${bold(basename(target))} already exists in ${bold(directory)}`,
      fix: 'move it aside and run migrate again — migrating would overwrite it'
    })
  }

  if (refusals.length > 0) {
    logger.error(`Cannot migrate ${bold(source)}:`)

    for (const refusal of refusals) {
      logger.error(`  ${refusal.reason}`)
      logger.error(`    ${refusal.fix}`)
    }

    process.exitCode = 1
    return
  }

  /*
    The swap happens before the validation, and it has to: v4 refuses a directory that still holds
    a legacy file, so validating with the original in place would fail for the one reason that says
    nothing about the emitted file. The original is kept in memory and put back if anything goes
    wrong, which is what makes a failed migration leave the project exactly as it was.
  */
  const journal = createJournal()
  const renamed = []
  let skipped = []

  if (runtime) {
    const { entries, emitted, inlined } = await emitApplications(journal, plan.applications)

    skipped = plan.skipped

    for (const application of emitted) {
      if (application.renamedFrom) {
        renamed.push({ from: application.renamedFrom, to: application.orchestration.id })
      }
    }

    await journal.write(target, emitRootConfiguration(config, entries, inlined, plan.autoload))
  } else {
    const derived = await deriveLegacyId(directory)

    if (derived.renamedFrom) {
      renamed.push({ from: derived.renamedFrom, to: derived.id })
    }

    await journal.write(target, emitApplicationConfiguration(config, { module, id: derived.id }))
  }

  await journal.remove(source)

  let unresolved = null

  try {
    /*
      A root file is loaded through the runtime rather than through foundation, because that is
      where the runtime schema is applied: foundation resolves the topology and validates each
      application against its capability's schema, and knows nothing about the root's own keys. A
      root emitted with a key v4 removed — `strictEnv`, say — passed straight through the check that
      exists to catch exactly that.
    */
    if (runtime) {
      await loadV4Runtime(target, null, { command: 'start', production: true, validateCapabilities: true })
    } else {
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
    }
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

  for (const { from, to } of renamed) {
    logger.warn(
      `The application id ${bold(from)} is not a legal v4 id and was written as ${bold(to)}. That name is also the mesh hostname, the injected PLT_*_URL variable, the metrics label and how siblings name it in dependencies — update anything that refers to the old spelling.`
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
