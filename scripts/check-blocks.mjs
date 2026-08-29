#!/usr/bin/env node

/*
  The gate for the fenced blocks in NEW_CONFIG.md and in the documentation pages that teach the
  same format.

  Three rounds of review found invalid examples by hand, including the sole illustration of the
  callback form, so the scope is every block rather than the ones somebody thought to check. The
  category is an explicit marker on the fence rather than something inferred from the language tag:
  an unmarked block fails, which is what stops the gate from quietly narrowing as blocks are added.

    ```ts config    a complete v4 configuration with a default export, standing alone, imports
                    included. Loaded through the real v4 loader and typechecked.
    ```ts decl      interfaces, type aliases and bodiless factory overloads -- a SyntaxError after
                    type stripping, and they export nothing. Typechecked only.
    ```ts source    TypeScript that is not configuration -- an application's own code, quoted to
                    show what it looks like. Type-stripped, which catches a syntax error without
                    pretending its imports resolve in this repository.
    ```json v3      legacy JSON input, validated against the v3 schema.
    ```output       terminal output, warnings, errors and directory trees. Checked for being fenced
                    and marked, which is all there is to check.

  NEW_CONFIG.md is the specification, so every one of its fences must carry a marker. A
  documentation page is not: it fences shell commands and v3 JSON and prose output that no marker
  describes, and demanding one on each would be ceremony. What it must mark is every **TypeScript**
  block -- the ones that claim to be configuration a reader can copy. That is the narrow rule, and
  it is still a rule rather than a guess: an unmarked `ts` block in a checked page fails.

  A page is checked because it is listed in `documents` below. Adding a page to the list is how its
  examples start being executed; leaving one off is visible in this file rather than implied by the
  absence of markers in the page.

  Usage: node scripts/check-blocks.mjs [--verbose]
*/

import { spawnSync } from 'node:child_process'
import { stripTypeScriptTypes } from 'node:module'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/*
  The type stripper is flagged experimental and Node says so on stderr. This script's output is a
  report, and a warning in the middle of it reads as one of its findings -- so that one is dropped
  and every other warning still prints.
*/
process.removeAllListeners('warning')
process.on('warning', warning => {
  if (warning.name !== 'ExperimentalWarning') {
    console.warn(warning)
  }
})

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/*
  `markEverything` is what separates the specification from a page about it: NEW_CONFIG.md fails on
  any unmarked fence, a page fails only on an unmarked TypeScript one.
*/
const documents = [
  { name: 'NEW_CONFIG.md', markEverything: true },
  { name: 'docs/guides/migrate-runtime-v4.md', markEverything: false },
  { name: 'docs/file-formats.md', markEverything: false },
  { name: 'docs/guides/generating-watt-configuration.md', markEverything: false },
  { name: 'docs/reference/runtime/_shared-configuration.md', markEverything: false },
  { name: 'docs/reference/service/configuration.md', markEverything: false },
  { name: 'docs/reference/db/configuration.md', markEverything: false },
  { name: 'docs/reference/gateway/configuration.md', markEverything: false },
  { name: 'docs/reference/next/configuration.md', markEverything: false },
  { name: 'docs/reference/nitro/configuration.md', markEverything: false },
  { name: 'docs/reference/nuxt/configuration.md', markEverything: false },
  { name: 'docs/reference/node/configuration.md', markEverything: false },
  { name: 'docs/reference/vite/configuration.md', markEverything: false },
  { name: 'docs/reference/astro/configuration.md', markEverything: false },
  { name: 'docs/reference/remix/configuration.md', markEverything: false },
  { name: 'docs/reference/nest/configuration.md', markEverything: false },
  { name: 'docs/reference/react-router/configuration.md', markEverything: false },
  { name: 'docs/reference/tanstack/configuration.md', markEverything: false },
  { name: 'docs/getting-started/port-your-app.md', markEverything: false },
  { name: 'docs/overview/what-is-watt.md', markEverything: false }
]

const typescriptLanguages = new Set(['ts', 'tsx', 'typescript'])
const workspace = join(root, 'tmp', 'check-blocks')
const markers = new Set(['config', 'decl', 'source', 'v3', 'output'])
const verbose = process.argv.includes('--verbose')

function parseBlocks (source) {
  const lines = source.split('\n')
  const blocks = []
  let open = null

  for (let i = 0; i < lines.length; i++) {
    /*
      Indentation is matched, not required to be absent. A fence inside a list item is indented, and
      a parser anchored at column zero does not see it -- which is a gate that skips blocks without
      saying so. Seven of one page's examples were invisible that way.
    */
    const fence = lines[i].match(/^(\s*)```(.*)$/)

    if (!fence) {
      continue
    }

    const [, indent, line] = fence

    if (open) {
      // Dedented by the opening fence's indent, so the content is the source a reader would copy.
      const content = lines
        .slice(open.start, i)
        .map(text => (text.startsWith(open.indent) ? text.slice(open.indent.length) : text))
        .join('\n')

      blocks.push({ ...open, end: i + 1, content })
      open = null
      continue
    }

    /*
      The info string is the language and the marker in either order, and a block whose content is
      terminal output has no language at all. The marker is recognised by name rather than by
      position so that `output` alone is a marked block and not a language nobody has heard of.
    */
    const info = line.trim().split(/\s+/).filter(Boolean)
    const marker = info.find(token => markers.has(token)) ?? ''

    /*
      A block that demonstrates a required-env guard throws without that variable, which is the
      point of the example. The fence declares what the block needs -- `env=NAME=value,NAME=value`
      -- rather than the gate guessing from the source, so what an example depends on is written
      down beside it.
    */
    const env = Object.fromEntries(
      (info.find(token => token.startsWith('env='))?.slice(4) ?? '')
        .split(',')
        .filter(Boolean)
        .map(pair => pair.split('=', 2))
    )

    /*
      Some examples exist to show what v4 refuses. Asserting the refusal is the check -- skipping
      them would leave the document's negative examples unverified, which is where a format's
      claims quietly stop being true.
    */
    const refused = info.includes('refused')
    const language = info.find(
      token => token !== marker && token !== 'refused' && !token.startsWith('env=')
    ) ?? ''
    open = { line: i + 1, start: i + 1, indent, language, marker, env, refused }
  }

  if (open) {
    return { blocks, unterminated: open.line }
  }

  return { blocks, unterminated: null }
}

/*
  A directory every workspace package resolves from. The blocks import `wattpm` and
  `@platformatic/<capability>` by name, exactly as a real project would, and neither the repository
  root nor any single package has the whole set linked.
*/
function prepareWorkspace () {
  rmSync(workspace, { recursive: true, force: true })
  mkdirSync(join(workspace, 'node_modules', '@platformatic'), { recursive: true })

  for (const entry of readdirSync(join(root, 'packages'), { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }

    const manifest = join(root, 'packages', entry.name, 'package.json')

    if (!existsSync(manifest)) {
      continue
    }

    const { name } = JSON.parse(readFileSync(manifest, 'utf-8'))

    if (!name) {
      continue
    }

    const target = join(workspace, 'node_modules', name)
    mkdirSync(dirname(target), { recursive: true })
    symlinkSync(join(root, 'packages', entry.name), target, 'dir')
  }

  writeFileSync(
    join(workspace, 'package.json'),
    JSON.stringify({ name: 'check-blocks', type: 'module', private: true }, null, 2)
  )

  writeFileSync(
    join(workspace, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          noEmit: true,
          module: 'nodenext',
          moduleResolution: 'nodenext',
          target: 'es2022',
          skipLibCheck: true,
          allowJs: true,
          types: ['node']
        }
      },
      null,
      2
    )
  )
}

/*
  The option types Appendix A's blocks name that the generated types still do not carry.

  The audit has run and the schemas carry titles now, so most of these names are real types the
  blocks import. These four are not: they live inside the runtime's application entry, and the
  generator pinned here collapses that entry to `{ [k: string]: unknown }` because the schema lists
  it three times -- once as `applications` and twice more as the v3 aliases. Its next major gets
  this right; that release is too new for this repository's minimum-release-age policy. The four are
  generated correctly in every capability schema, which lists the entry once.

  Listed by name rather than matched by shape, and reported rather than declared into existence: a
  name that is not on this list is a typo, a type somebody forgot, or -- as four of these were --
  one that already exists and the block simply failed to import.
*/
const pendingGeneratedTypes = new Set([
  'ApplicationHealthOptions',
  'ApplicationTelemetryOverrides',
  'ApplicationWorkersOptions',
  'PermissionsOptions'
])

function typecheck (files) {
  // The shape the caller destructures, on every path. Returning a bare array here was survivable
  // only while the pending generated types kept tsc exiting non-zero on every run.
  if (files.length === 0) {
    return { failures: [], pending: new Set() }
  }

  const result = spawnSync(
    process.execPath,
    [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit', '--project', 'tsconfig.json'],
    { cwd: workspace, encoding: 'utf-8' }
  )

  if (result.status === 0) {
    return { failures: [], pending: new Set() }
  }

  const errors = (result.stdout || result.stderr || '').split('\n').filter(line => line.includes('error TS'))
  const failures = []
  const pending = new Set()

  for (const error of errors) {
    /*
      A bodiless overload is what a `decl` block is *for* -- the marker's whole definition includes
      them -- so reporting one contradicts the contract this gate publishes.
    */
    if (error.includes('error TS2391') && error.startsWith('block-')) {
      continue
    }

    // TS2552 is the same finding with a suggestion attached -- tsc offers the nearest name it can
    // see, which for `WorkersOptions` is Node's own `WorkerOptions` and is not what the block means.
    const missing = error.match(/error TS(?:2304|2552): Cannot find name '([^']+)'/)

    if (missing && pendingGeneratedTypes.has(missing[1])) {
      pending.add(missing[1])
      continue
    }

    failures.push(error)
  }

  return { failures, pending }
}

/*
  A block that names a nested file in its first line -- `// web/frontend/watt.config.ts` -- is a
  per-application configuration, and loading it as a runtime root would be checking it against the
  wrong schema entirely. It is evaluated the way the loader evaluates a per-app file instead.
*/
function declaredPath (content) {
  const first = content.split('\n', 1)[0].trim()
  const match = first.match(/^\/\/\s*([\w./-]*watt\.config\.[a-z]+)/)

  return match ? match[1] : null
}

async function loadConfigBlock (file, nested, env) {
  const realEnv = { ...process.env, ...env }

  if (nested) {
    const { evaluateConfigurationFile } = await import(
      pathToFileURL(join(root, 'packages/foundation/lib/v4/evaluate.js')).href
    )

    await evaluateConfigurationFile({ path: file, env: realEnv, command: 'start', production: false })
    return
  }

  /*
    The runtime's loader rather than foundation's. Foundation's is the eval worker's shape check,
    which deliberately injects nothing and does not apply the runtime schema -- so it accepted
    `strictEnv`, a key v4 removed, and a block using it read as verified. This is the load a boot
    performs.
  */
  const { loadConfiguration } = await import(pathToFileURL(join(root, 'packages/runtime/index.js')).href)
  const previous = process.env
  process.env = realEnv

  try {
    await loadConfiguration(file)
  } finally {
    process.env = previous
  }
}

function validateV3 (content) {
  JSON.parse(content)
}

/*
  Every block a document asks to have categorised. A block the rule does not reach keeps its empty
  marker and is skipped, which for a documentation page is a shell command or a v3 JSON example the
  prose is quoting.
*/
function collectMarkerFailures (name, blocks, markEverything) {
  const failures = []

  for (const block of blocks) {
    if (markers.has(block.marker)) {
      continue
    }

    if (markEverything) {
      failures.push(
        `${name}:${block.line}: fence carries no category marker (expected one of ${[...markers].join(', ')})`
      )
    } else if (typescriptLanguages.has(block.language)) {
      failures.push(
        `${name}:${block.line}: TypeScript fence carries no category marker (expected config, decl or source)`
      )
    }
  }

  return failures
}

async function main () {
  prepareWorkspace()

  const typecheckable = []
  const failures = []
  const summaries = []

  for (const [documentIndex, { name, markEverything }] of documents.entries()) {
    const { blocks, unterminated } = parseBlocks(readFileSync(join(root, name), 'utf-8'))

    summaries.push({ name, blocks })

    if (unterminated !== null) {
      failures.push(`${name}:${unterminated}: fence is never closed`)
      continue
    }

    const markerFailures = collectMarkerFailures(name, blocks, markEverything)

    if (markerFailures.length > 0) {
      /*
        Categorising the blocks is the prerequisite for checking any of them, so an unmarked block
        stops this document rather than producing errors from a partial run of it.
      */
      failures.push(...markerFailures)
      continue
    }

    await checkDocument(name, documentIndex, blocks, failures, typecheckable)
  }

  const { failures: typeErrors, pending } = typecheck(typecheckable)

  for (const error of typeErrors) {
    failures.push(`typecheck: ${error}`)
  }

  report(summaries, failures, pending)
}

async function checkDocument (name, documentIndex, blocks, failures, typecheckable) {
  for (const [index, block] of blocks.entries()) {
    /*
      Unmarked and allowed to be: a shell command, or JSON the prose is quoting. Only a page reaches
      here with one -- the specification stops before this on any unmarked fence -- and the check
      has to be explicit, because the branches below end in `config` and would otherwise hand the
      loader a block of shell.
    */
    if (!markers.has(block.marker) || block.marker === 'output') {
      continue
    }

    if (block.marker === 'source') {
      /*
        Stripped rather than typechecked. It is an application's own code quoted for illustration,
        so its imports are the reader's dependencies and not this repository's -- but it is still
        TypeScript, and a snippet that does not parse is wrong on the page whatever it imports.
      */
      try {
        stripTypeScriptTypes(block.content, { mode: 'strip' })
      } catch (error) {
        failures.push(`${name}:${block.line}: ${error.message.split('\n')[0]}`)
      }

      continue
    }

    if (block.marker === 'v3') {
      try {
        validateV3(block.content)
      } catch (error) {
        failures.push(`${name}:${block.line}: ${error.message}`)
      }

      continue
    }

    // Unique across documents, because every block shares one workspace directory.
    const slug = `block-${documentIndex}-${String(index).padStart(2, '0')}`

    if (block.marker === 'decl') {
      /*
        `export {}` forces module scope. Without it a block that neither imports nor exports is a
        global script, and every declaration in the document shares one namespace -- so two blocks
        quoting the same exported name collide with each other rather than being checked.
      */
      const file = join(workspace, `${slug}.ts`)
      writeFileSync(file, `${block.content}\n\nexport {}\n`)
      typecheckable.push(file)
      continue
    }

    // config: it has to stand alone, so it gets a directory of its own -- which is also what the
    // loader needs, since exactly one configuration lives in a directory.
    const directory = join(workspace, slug)
    mkdirSync(directory, { recursive: true })
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ name: slug, type: 'module' }, null, 2))

    const declared = declaredPath(block.content)
    const nested = declared?.includes('/') ?? false
    const relative = declared ?? (block.language === 'js' ? 'watt.config.js' : 'watt.config.ts')
    const file = join(directory, relative)

    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, `${block.content}\n`)
    typecheckable.push(file)

    /*
      A root configuration that autoloads `web` does not stand alone until `web` exists, so the
      directories the block names are created before it is loaded -- the same thing a reader
      following the example would do.
    */
    for (const [, named] of block.content.matchAll(/path:\s*'([^'\n]+)'/g)) {
      const application = join(directory, named)
      mkdirSync(application, { recursive: true })

      /*
        Seeded rather than merely created. An entry that names a path points at an application, and
        the loader detects that application's capability from what is in the directory -- an empty
        one declares nothing and fails, so a block would be reported for the fixture instead of for
        itself. A `package.json` and a JavaScript file are what the reader following the example
        has, and what the detector reads as a plain Node.js application.
      */
      if (!existsSync(join(application, 'package.json'))) {
        writeFileSync(
          join(application, 'package.json'),
          JSON.stringify({ name: basename(named), type: 'module' }, null, 2)
        )
        writeFileSync(join(application, 'index.js'), 'export function build () {}\n')
      }
    }

    try {
      await loadConfigBlock(file, nested, block.env)

      if (block.refused) {
        failures.push(`${name}:${block.line}: marked refused, but the loader accepted it`)
      }
    } catch (error) {
      if (!block.refused) {
        /*
          Three lines rather than one: a schema failure says "does not validate against the
          @platformatic/runtime schema:" and then lists what was wrong, so the first line alone
          names the block without saying anything about it.
        */
        failures.push(`${name}:${block.line}: ${error.message.split('\n').slice(0, 3).join(' ').trim()}`)
      }
    }
  }
}

function report (summaries, failures, pending = new Set()) {
  for (const { name, blocks } of summaries) {
    const counts = {}

    for (const block of blocks) {
      counts[block.marker || '(unmarked)'] = (counts[block.marker || '(unmarked)'] ?? 0) + 1
    }

    console.log(
      `${name}: ${blocks.length} blocks — ${Object.entries(counts)
        .map(([marker, count]) => `${count} ${marker}`)
        .join(', ')}`
    )
  }

  if (pending.size > 0) {
    // Named rather than hidden: this is the generation the blocks are waiting on, and a gate that
    // said nothing about it would read as though the document were fully checked.
    console.log(
      `\npending generated types (${pending.size}): ${[...pending].sort().join(', ')}`
    )
  }

  if (failures.length === 0) {
    console.log('\nOK')
    return
  }

  console.log(`\nfailures (${failures.length}):`)

  for (const failure of failures) {
    console.log(`  ${failure}`)
  }

  process.exitCode = 1
}

await main()

if (!verbose) {
  rmSync(workspace, { recursive: true, force: true })
}
