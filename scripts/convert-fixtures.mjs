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

import { existsSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(import.meta.dirname, '..')

// v3 interpolation: {X} and {{X}} alike, the pattern the v3 loader used.
const INTERPOLATION = /\{\{?([A-Za-z0-9_]+)\}?\}/g

// Properties whose schema type is a number, so an interpolated value has to be coerced explicitly:
// v4 turns AJV coercion off, and a string where the schema says number is a validation failure
// rather than a silent conversion.
/*
  Properties whose schema type is boolean, so an interpolated value has to be compared explicitly:
  v4 turns AJV coercion off, and the string 'false' is not the boolean false -- it is not even
  falsy. v3 coerced these silently, which is exactly the silence v4 removes.
*/
const BOOLEAN_PROPERTIES = new Set([
  'watch',
  'enabled',
  'production',
  'https',
  'dynamic',
  'reusePort',
  'reuseTcpPorts',
  'closeConnections',
  'metrics',
  'managementApi',
  'openapi',
  'graphql',
  'absoluteUrl',
  'skipTelemetryHooks',
  'encapsulate'
])

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
    /*
      A literal `"0"` where the schema wants a number. v3 coerced it on the way in -- its validator
      runs with coerceTypes -- and v4's does not, so the string that used to work is now a
      validation error. The value is the same either way; only its spelling was a v3 convenience.
    */
    if (NUMERIC_PROPERTIES.has(key) && /^-?\d+(\.\d+)?$/.test(value)) {
      return Number(value)
    }

    if (BOOLEAN_PROPERTIES.has(key) && (value === 'true' || value === 'false')) {
      return value === 'true'
    }

    return value
  }

  INTERPOLATION.lastIndex = 0
  const whole = value.match(/^\{\{?([A-Za-z0-9_]+)\}?\}$/)

  if (whole) {
    const read = `process.env.${whole[1]}`

    if (NUMERIC_PROPERTIES.has(key)) {
      /*
        `?? 0` because an unset variable is a state v3 tolerated: a `{{PORT}}` nobody set resolved
        to an empty string and the runtime assigned a port. `Number(undefined)` is NaN, which the
        canonicalizer refuses -- so the fixture would stop loading rather than pick a port.
      */
      return new Expression(`Number(${read} ?? 0)`)
    }

    if (BOOLEAN_PROPERTIES.has(key)) {
      return new Expression(`${read} === 'true'`)
    }

    return new Expression(read)
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

/*
  A configuration that predates $schema still says what it is: a db block belongs to db, a gateway
  block to gateway. The capability name is the block name, so this reads the same discriminator by
  another route rather than guessing.
*/
function moduleFromCapabilityBlock (config) {
  const blocks = [...servingDeclarations.keys()]
    .map(module => [module, module.replace('@platformatic/', '')])
    .filter(([, name]) => config[name] && typeof config[name] === 'object')

  return blocks.length === 1 ? blocks[0][0] : null
}

function moduleFromSchema (config, file) {
  if (typeof config.module === 'string') {
    return config.module
  }

  const url = config.$schema

  if (typeof url !== 'string') {
    return moduleFromFilename(file) ?? moduleFromCapabilityBlock(config)
  }

  /*
    Two spellings, because the schema host moved. The current one puts the capability first --
    schemas.platformatic.dev/@platformatic/runtime/2.0.0.json -- and the older one puts it last,
    after the version: platformatic.dev/schemas/v2.0.0/runtime.
  */
  const match =
    url.match(/schemas\.platformatic\.dev\/(?:@platformatic\/)?([a-z-]+)\//) ??
    url.match(/platformatic\.dev\/schemas\/v[\d.]+\/([a-z-]+)$/)

  if (!match) {
    return moduleFromFilename(file) ?? moduleFromCapabilityBlock(config)
  }

  const name = match[1]

  return name === 'wattpm' ? '@platformatic/runtime' : `@platformatic/${name}`
}

/*
  Read from the capability itself rather than a table here: servesWithoutPort is declared in each
  capability's schema, and a copy in this script would be wrong the first time one of them changed
  its mind. A capability whose answer is a callable or 'worker' is not decided by configuration
  alone, and the loader defers those to the started worker, so neither needs a port written in.
*/
/*
  Loaded by importing each capability rather than by reading its source. servesWithoutPort is
  sometimes a callable -- vite decides from the configuration, because an SSR application with a
  Fastify factory serves in-process and an ordinary one does not -- and a regex over the source
  cannot answer that. Importing gets both forms, and the callable can then be asked about the very
  configuration being converted.
*/
const servingDeclarations = new Map()

for (const entry of readdirSync(join(ROOT, 'packages'), { withFileTypes: true })) {
  if (!entry.isDirectory()) {
    continue
  }

  const schemaPath = join(ROOT, 'packages', entry.name, 'lib', 'schema.js')

  if (!existsSync(schemaPath)) {
    continue
  }

  try {
    const { servesWithoutPort } = await import(pathToFileURL(schemaPath).href)

    if (servesWithoutPort !== undefined) {
      servingDeclarations.set(`@platformatic/${entry.name}`, servesWithoutPort)
    }
  } catch {
    // A capability that cannot be imported here is one this script has nothing to say about.
  }
}

export function needsExplicitPort (module, config) {
  let declaration = servingDeclarations.get(module)

  // 'worker' means the loader defers to the started worker, so nothing is decided here.
  if (declaration === undefined || declaration === 'worker') {
    return false
  }

  // A declared command starts the application on its own terms and is checked before the port.
  if (config.server?.port !== undefined || config.application?.commands) {
    return false
  }

  if (typeof declaration === 'function') {
    declaration = declaration(config)
  }

  if (declaration === 'worker' || typeof declaration !== 'object' || declaration === null) {
    return false
  }

  return declaration.development === false || declaration.production === false
}

/*
  Fixtures that exist to be old. The upgrade chains are tested by loading a configuration written
  for a released version and checking what it becomes, so converting one destroys the only thing it
  was for -- and the conversion would be to a format that version never had.
*/
/*
  Empty: a capability command pointed at a file evaluates it with the v4 loader now, the same one a
  boot uses, so the fixtures its tests name are ordinary v4 configurations.
*/
const COMMAND_FIXTURES = []

/*
  A capability's own create() evaluates a v4 file with the loader a boot uses, so the fixtures it
  reads are ordinary v4 configurations. What remains is one file that is not a fixture directory's
  configuration at all.
*/
const CAPABILITY_FIXTURES = [
  /*
    A loose file directly under the runtime's fixtures root, named for the test that passes it.
    Converting it in place would put a `watt.config.js` at the top of a tree holding a few hundred
    other fixtures, and every one of them would then be an application of *that* configuration --
    so it stays until something reads it again, which nothing currently does.
  */
  'runtime/fixtures/no-env.service.json'
]

/*
  Empty: `wattpm import` writes v4 now, and the v3 loader that read these is gone. They convert like
  everything else.
*/
const IMPORT_FIXTURES = []

/*
  Fixtures that exist to be a particular file format. auto-config keeps the same configuration as
  json, json5, yaml, toml, yml and tml side by side, and the test asserts the v3 loader reads each
  one. Converting the json member leaves the family testing five formats and a module.
*/
/*
  strictEnv, root envfile and the YAML brace-quoting pre-pass do not exist in v4 -- they survive
  only inside migrate's legacy reader -- so the fixtures that exercise them stay with the v3 loader
  that still implements them.
*/
/*
  And the fixtures that exist to be read *by the v3 loader*. `Controller` reads a configuration file
  with it, and `wrapInRuntimeConfig` -- which v4 deletes -- is exercised against these directly, so
  a v4 file here is not read by anything and the v3 file it replaced is what the test opens by name.
  `service-app-throws-v3` says so in its own name: it is a copy of another fixture made precisely
  because one directory cannot serve both loaders.

  They convert when the machinery that reads them goes.
*/
const LEGACY_FEATURE_FIXTURES = [
  'runtime/fixtures/configs/monorepo-strict-env/',
  // Nothing: the last reader of a v3 configuration file, `Controller`'s worker-side branch, is gone.
]

const FORMAT_FIXTURES = [
  'db/test/fixtures/auto-config/',
  'service/test/fixtures/auto-config/',
  // The same configuration in every format the v3 loader accepts, one file each.
  'db/test/fixtures/valid-config-files/'
]

/*
  A configuration is recognized by what it holds, not only by what it is called. Forty-five of the
  runtime's own fixtures are named for the test that passes them -- service-with-env-port.json,
  monorepo.json -- and a filename rule skips every one of them while they are as much v3
  configuration as the ones that happen to start with "platformatic".

  These are the names that are certainly not configurations, and a $schema pointing at the schema
  host or a module naming a capability is what identifies the rest.
*/
const NEVER_A_CONFIGURATION = new Set(['package.json', 'package-lock.json', 'tsconfig.json', 'jsconfig.json', 'schema.json'])

export function isConfigurationFile (file) {
  const name = basename(file)

  if (V3_NAME.test(name)) {
    return true
  }

  if (!name.endsWith('.json') || NEVER_A_CONFIGURATION.has(name)) {
    return false
  }

  let parsed

  try {
    parsed = JSON.parse(readFileSync(file, 'utf-8'))
  } catch {
    return false
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return false
  }

  /*
    Two hosts, because the corpus spans the move: the current schemas.platformatic.dev and the
    older platformatic.dev/schemas/<version>/<name> that fixtures written years ago still carry.
    Matching only the current one skipped every one of the older ones.
  */
  return (
    (typeof parsed.$schema === 'string' &&
      (parsed.$schema.includes('schemas.platformatic.dev') || /platformatic\.dev\/schemas\//.test(parsed.$schema))) ||
    (typeof parsed.module === 'string' && parsed.module.startsWith('@platformatic/'))
  )
}

export function isLegacyByDesign (file) {
  if (/[\\/](fixtures[\\/])?versions[\\/]/.test(file)) {
    return true
  }

  /*
    Input to wattpm import, whose whole job is to write configuration files. Its tests assert what
    the command produces, so a fixture converted ahead of the command would be testing the
    conversion rather than the import. These convert when import learns to emit the v4 form.
  */
  const normalized = file.replace(/\\/g, '/')

  return [...IMPORT_FIXTURES, ...FORMAT_FIXTURES, ...COMMAND_FIXTURES, ...CAPABILITY_FIXTURES, ...LEGACY_FEATURE_FIXTURES].some(fixture =>
    normalized.includes(fixture)
  )
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

    if (converted.server) {
      /*
        Dropped rather than moved into an application. This looks like losing a listener, and it is
        not: the shipped upgrade chain already deletes a runtime-level server on the way to 4.0.0
        (runtime/lib/versions/v4.0.0.js), so the block has no effect on the runtime that reads it
        today. Moving a port that nothing honours into an application would change behaviour rather
        than preserve it.
      */
      notes.push('dropped the root server block, which the 4.0.0 upgrade already removes')
      delete converted.server
    }

    if (converted.entrypoint) {
      // Removed by the same upgrade step, and for the same reason.
      notes.push('dropped entrypoint, which the 4.0.0 upgrade already removes')
      delete converted.entrypoint
    }

    if (converted.runtime) {
      refusals.push('carries a wrapped runtime block, which v4 flattens to the top level')
    }

    /*
      Both places an entry can name its configuration: the applications list and the autoload
      mappings. v4 discovers a per-application file by directory, and config in an entry means an
      inline definition -- so a mapping that kept its filename becomes an application configured
      twice, which the loader refuses by name.
    */
    const entries = [...(converted.applications ?? []), ...Object.values(converted.autoload?.mappings ?? {})]

    for (const entry of entries) {
      if (typeof entry.config === 'string') {
        notes.push(`entry '${entry.id ?? '?'}' referenced ${entry.config}; convert that file in place`)
        delete entry.config
      }
    }
  } else if (module) {
    /*
      A framework capability that does not serve without a listener has to be given one. v3 had a
      runtime-level entrypoint and buildListenOptions(undefined) handing out { port: 0 }, so these
      configurations never needed to say anything; under v4 exposure is the application's own and
      the loader refuses one that would start nothing.

      The port is 0 rather than the 3042 scaffolding writes: this is a conversion of something that
      already worked, and what it had was an ephemeral port. A fixed port would also collide the
      moment two of these fixtures run at once.
    */
    /*
      composer became gateway, and the capability's options block is named for the capability. A
      configuration whose module was rewritten but whose block was not fails validation against a
      schema that has never heard of composer.
    */
    if ((module === '@platformatic/gateway' || module === '@platformatic/composer') && converted.composer) {
      converted.gateway = { ...converted.composer, ...converted.gateway }
      delete converted.composer
      notes.push('the composer block became the gateway block')
    }

    /*
      The gateway's own list of applications was spelled services when the capability was called
      composer, and renaming the block does not rename what is inside it. v4's gateway schema has
      applications and refuses the old key outright, so a configuration converted without this
      fails validation with a message about a property the author never wrote.
    */
    if ((module === '@platformatic/gateway' || module === '@platformatic/composer') && converted.gateway?.services) {
      converted.gateway = {
        ...converted.gateway,
        applications: [...(converted.gateway.applications ?? []), ...converted.gateway.services]
      }

      delete converted.gateway.services
      notes.push("gateway.services became gateway.applications")
    }

    /*
      Keys that outlived the features they configured. plugins.typescript went with the ts-compiler
      in ae2fab511 and clients went with client support in 0b6b448c6; no capability schema declares
      either, and every one of them refuses unknown properties. The v3 schema rejects them too --
      they were simply never validated on the path these configurations took -- so dropping them
      repairs a configuration that was already wrong rather than translating one that was right.
    */
    if (converted.plugins && 'typescript' in converted.plugins) {
      delete converted.plugins.typescript
      notes.push('dropped plugins.typescript, which no capability schema has declared since ae2fab511')
    }

    /*
      services became applications everywhere, including inside gracefulShutdown, where v3 spelled
      the per-application timeout "service". The runtime schema has application and refuses the
      old key.
    */
    if (converted.gracefulShutdown && 'service' in converted.gracefulShutdown) {
      converted.gracefulShutdown = {
        ...converted.gracefulShutdown,
        application: converted.gracefulShutdown.application ?? converted.gracefulShutdown.service
      }

      delete converted.gracefulShutdown.service
      notes.push('gracefulShutdown.service became gracefulShutdown.application')
    }

    /*
      The same rename one level up: v3 called the mesh timeout serviceTimeout, and the v3.0.0
      upgrade rewrote it. v4 has no upgrade chain, so a converted fixture has to carry the new name.
    */
    if ('serviceTimeout' in converted) {
      converted.applicationTimeout = converted.applicationTimeout ?? converted.serviceTimeout
      delete converted.serviceTimeout
      notes.push('serviceTimeout became applicationTimeout')
    }

    if ('clients' in converted) {
      delete converted.clients
      notes.push('dropped clients, which @platformatic/service stopped supporting in 0b6b448c6')
    }

    if (needsExplicitPort(module, converted)) {
      converted.server = { ...converted.server, port: 0 }
      notes.push(`${module} does not serve without a listener, so an ephemeral server.port was added`)
    }

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

const V3_NAME = /^(watt|platformatic)([.-][a-z0-9.-]+)?\.json$/

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
    } else if (isConfigurationFile(path) && !isLegacyByDesign(path)) {
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
