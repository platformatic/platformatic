import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/*
  Writing a v4 configuration file.

  Three machine writers produce one -- scaffolding, `wattpm import` and `wattpm-utils migrate` --
  and they are in different packages. Sharing the serializer and the suffix rule is what keeps them
  from drifting apart on questions the format has one answer to: which quote, which filename in a
  CommonJS package, and how an expression is spelled inside an object literal.
*/

/*
  The factory each in-tree capability exports. A capability outside this table is spelled with the
  plain object form, which stays part of v4 for capabilities that implement the contract without
  shipping a factory.

  Here rather than in each writer, because all three of them ask the same question and an answer
  that differs between them is a configuration that boots under one and not the other.
*/
export const capabilityFactories = {
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

/*
  A value that is already source. `config: next({ … })` is a call inside an object literal, and
  quoting it would emit the text of a call rather than the call.
*/
const rawExpression = Symbol('plt.foundation.v4.raw')

export function raw (source) {
  return { [rawExpression]: source }
}

export function serializeConfiguration (value, indent = 0) {
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

    return `[\n${value.map(entry => `${inner}${serializeConfiguration(entry, indent + 1)}`).join(',\n')}\n${pad}]`
  }

  const entries = Object.entries(value).filter(([, entry]) => entry !== undefined)

  if (entries.length === 0) {
    return '{}'
  }

  return `{\n${entries
    .map(([key, entry]) => `${inner}${serializeKey(key)}: ${serializeConfiguration(entry, indent + 1)}`)
    .join(',\n')}\n${pad}}`
}

// Quoted only when it has to be. These files are read by people, and `'cache'` where `cache` would
// do is the kind of thing that makes generated output look generated.
export function serializeKey (key) {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : serializeString(key)
}

// Single quotes, because the file lands in a project whose other files use them and a writer should
// not leave a seam showing where it touched.
export function serializeString (value) {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`
}

/*
  The filename a writer should use in a directory.

  The rule that matters is the suffix: `.js` in a `"type": "commonjs"` package is CommonJS, where
  `export default` is a syntax error, so a writer emitting there must reach for the unambiguous
  extension instead. Whether the file is TypeScript is the writer's own decision -- scaffolding
  emits it, because it is writing a project from nothing and can choose; migrate does not, because
  it is converting one that never asked for it.
*/
export function chooseConfigurationFileName (root, { typescript = false } = {}) {
  let module = false

  try {
    module = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'))?.type === 'module'
  } catch {
    // Absent or unreadable. The ambiguous suffix is the one that needs the answer, so not knowing
    // it means choosing the suffix that does not.
  }

  return configurationFileNameFor({ module, typescript })
}

/*
  The same rule for a writer that already knows the answer rather than having to read it -- a
  generator writes the package.json in the same pass, so asking the filesystem would be asking about
  a file it is holding.
*/
export function configurationFileNameFor ({ module = false, typescript = false } = {}) {
  if (typescript) {
    return module ? 'watt.config.ts' : 'watt.config.mts'
  }

  return module ? 'watt.config.js' : 'watt.config.mjs'
}

// A directory with no package.json resolves its imports from an ancestor that has one, so the
// question this answers is about that ancestor.
export function isModulePackage (root) {
  return existsSync(join(root, 'package.json')) && chooseConfigurationFileName(root).endsWith('.js')
}
