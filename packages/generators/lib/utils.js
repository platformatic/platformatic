import {
  listDirectoryEntries,
  selectConfigurationFileNames,
  selectLegacyConfigurationFileNames
} from '@platformatic/foundation/lib/v4/index.js'
import { builders, generateCode, parseModule } from 'magicast'
import { readFile } from 'node:fs/promises'
import { EOL } from 'node:os'
import { join } from 'node:path'
import { setTimeout } from 'timers/promises'
import { request } from 'undici'
import { WrongTypeError } from './errors.js'

export const PLT_ROOT = 'PLT_ROOT'

/**
 * Strip all extra characters from a simple semver version string
 * @param {string} version
 * @returns string
 */
export function stripVersion (version) {
  const match = version.match(/(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)/)
  if (match) {
    return match[0]
  }
  /* c8 ignore next */
  return version
}

export function convertApplicationNameToPrefix (applicationName) {
  return applicationName.replace(/-/g, '_').toUpperCase()
}

export function addPrefixToString (input, prefix) {
  if (!prefix) {
    return input
  }
  const prefixRegExp = new RegExp(`^PLT_${prefix}_`)
  if (!input.match(prefixRegExp)) {
    // strip PLT_ if needed
    input = input.replace(/^PLT_/, '')
    return [`PLT_${prefix}_${input}`]
  } else {
    return input
  }
}

export function envObjectToString (env) {
  const output = []
  Object.entries(env).forEach(kv => {
    output.push(`${kv[0]}=${kv[1]}`)
  })
  return output.join(EOL)
}

export function envStringToObject (envString) {
  const output = {}
  const split = envString.split(/\r?\n/)
  split
    .filter(line => {
      return line.trim() !== '' && line.indexOf('#') !== 0
    })
    .forEach(line => {
      const kv = line.split('=')
      output[kv[0]] = kv[1]
    })
  return output
}

export function extractEnvVariablesFromText (text) {
  const match = text.match(/\{[a-zA-Z0-9-_]*\}/g)
  if (match) {
    return match.map(found => found.replace('{', '').replace('}', '')).filter(found => found !== '')
  }
  return []
}

export function getPackageConfigurationObject (config, applicationName = '') {
  const output = {
    config: {},
    env: {}
  }
  let current = output.config
  for (const param of config) {
    const props = param.path.split('.')
    props.forEach((prop, idx) => {
      if (idx === props.length - 1) {
        let value
        let isPath = false
        switch (param.type) {
          case 'string':
            value = param.value.toString()
            break
          case 'number':
            value = parseInt(param.value)
            break
          case 'boolean':
            value = param.value === 'true'
            break
          case 'path':
            value = `${join(`{${PLT_ROOT}}`, param.value)}`
            isPath = true
            break
          default:
            throw new WrongTypeError(param.type)
        }
        if (!param.name) {
          current[prop] = value
        } else {
          const key = addPrefixToString(param.name, convertApplicationNameToPrefix(applicationName))
          // If it's a path, we need to add it to the env only the relative part of the path
          if (isPath) {
            current[prop] = `${join(`{${PLT_ROOT}}`, `{${key}}`)}`
            value = param.value
          } else {
            current[prop] = `{${key}}`
          }
          output.env[key] = value
        }
        current = output.config
      } else {
        if (!current[prop]) {
          current[prop] = {}
        }
        current = current[prop]
      }
    })
  }
  return output
}

export async function getLatestNpmVersion (pkg) {
  const npmCall = request(`https://registry.npmjs.org/${pkg}`)
  const timeout = setTimeout(1000, null)
  const res = await Promise.race([npmCall, timeout])
  if (!res) {
    return null
  }
  clearTimeout(timeout)
  if (res.statusCode === 200) {
    const json = await res.body.json()
    return json['dist-tags'].latest
  }
  return null
}

/**
 * Flatten a deep-nested object to a single level depth one
 * i.e from
 * {
 *  name: 'test',
 *  a: {
 *    b: {
 *      c: 'foobar'
 *    }
 *  }
 * }
 * to:
 * {
 *    name: 'test',
 *    'a.b.c': 'foobar'
 * }
 * @param {Object} ob
 * @returns Object
 */
export function flattenObject (ob) {
  const result = {}
  for (const i in ob) {
    if (typeof ob[i] === 'object' && !Array.isArray(ob[i])) {
      const temp = flattenObject(ob[i])
      for (const j in temp) {
        result[i + '.' + j] = temp[j]
      }
    } else {
      result[i] = ob[i]
    }
  }
  return result
}

export function getApplicationTemplateFromSchemaUrl (schemaUrl) {
  const splitted = schemaUrl.split('/')

  /* c8 ignore next 3 - Legacy interface */
  if (schemaUrl.startsWith('https://platformatic.dev/schemas')) {
    return `@platformatic/${splitted[splitted.length - 1]}`
  }
  return `@platformatic/${splitted[splitted.length - 2]}`
}

/*
  The configuration file in a directory, whichever dialect it is in. A generator reading an existing
  project meets both: one it scaffolded under v4, and one that predates the switch.
*/
export async function findAnyConfigurationFile (directory) {
  const entries = await listDirectoryEntries(directory)

  return selectConfigurationFileNames(entries)[0] ?? selectLegacyConfigurationFileNames(entries)[0] ?? null
}

// The environment a project supplies to its own configuration. Absent is the same as empty here:
// a project without one simply has nothing to layer.
export async function readEnvFile (directory) {
  try {
    return envStringToObject(await readFile(join(directory, '.env'), 'utf-8'))
  } catch {
    return {}
  }
}

/*
  Whether two spellings of a module say the same thing. Used to decide that an edit produced no
  change: the printer reflows what it touches, so comparing the text byte for byte would report a
  change on every update whether or not one happened.
*/
export function equivalentSource (left, right) {
  /*
    Whitespace removed rather than collapsed, because the printer's difference is exactly one space:
    `packages: [{` against `packages: [\n  {`. Two spellings that differ only inside a string
    literal would compare equal here, and the consequence of that is leaving a file alone whose only
    change was spaces inside a string -- which is the harmless direction to be wrong in.
  */
  return left.replace(/\s/g, '') === right.replace(/\s/g, '')
}

/*
  A string to be printed as source rather than as a string literal. Exported so that a caller
  outside this package can hand one to `resolveScaffoldedPlaceholders` without taking on the AST
  library itself.
*/
export const rawSource = builders.raw

/*
  Add applications to an existing root configuration by editing the file the user has, rather than
  by writing a new one from the configuration the loader returned.

  The difference is everything the source says and the loaded configuration does not:
  `process.env.PLT_SERVER_LOGGER_LEVEL` comes back as `'info'`, a factory call comes back as the
  object it built, and comments come back not at all. Re-emitting replaces each of those with the
  value it happened to have on the machine doing the writing.

  Returns `null` when the file's shape cannot be edited in place -- a configuration built by a call,
  or held in a variable, or an application list that is not a literal array. There is nothing to
  edit there, and the caller is expected to say so rather than to write something else.
*/
export function appendApplications (source, entries, resolveEntry = entry => entry) {
  const module = parseModule(source)
  const target = module.exports.default
  // The plain object form exports the configuration; the factory form passes it as the first argument.
  const configuration = target?.$type === 'function-call' ? target.$args[0] : target

  if (configuration?.$type !== 'object') {
    return null
  }

  // One spelling: the loader refuses `services` and `web` by name, so a file this editor sees
  // lists its applications under `applications` or not at all.
  const key = 'applications'
  const listed = configuration[key] ?? []

  if (!Array.isArray(listed)) {
    return null
  }

  const present = new Set(Array.from(listed, entry => entry.id))
  const added = entries.filter(entry => entry.id && !present.has(entry.id))

  if (added.length === 0) {
    return source
  }

  configuration[key] = [...listed, ...added.map(entry => resolveEntry(entry))]

  return generateCode(module).code
}

// The applications a configuration lists. One spelling: the v3 aliases are refused by the loader.
export function listedApplications (config) {
  return config?.applications ?? []
}

/*
  The environment variable an expression reads, if it reads one.

  `process.env.NAME` is the bare form; `process.env.NAME ?? ''` and `process.env.NAME || 3042` are
  what a writer emits when the position needs a fallback. All three name the same variable, and the
  fallback is not part of the name.
*/
function environmentReference (node) {
  if (!node) {
    return null
  }

  if (node.type === 'LogicalExpression') {
    return environmentReference(node.left)
  }

  if (node.type !== 'MemberExpression' || node.property?.type !== 'Identifier') {
    return null
  }

  const { object } = node

  if (object?.type !== 'MemberExpression' || object.object?.name !== 'process' || object.property?.name !== 'env') {
    return null
  }

  return node.property.name
}

function collectEnvironmentReferences (node, path, found) {
  if (!node) {
    return
  }

  if (node.type === 'ObjectExpression') {
    for (const property of node.properties) {
      const key = property.key?.name ?? property.key?.value

      if (key !== undefined) {
        collectEnvironmentReferences(property.value, [...path, key], found)
      }
    }

    return
  }

  if (node.type === 'ArrayExpression') {
    node.elements.forEach((element, index) => collectEnvironmentReferences(element, [...path, index], found))
    return
  }

  const name = environmentReference(node)

  if (name) {
    found.set(path.join('.'), name)
  }
}

/*
  Which values in a configuration come from the environment, by their path in it.

  A v3 configuration said this in its data: `"port": "{PORT}"` survives being read as JSON. A v4
  configuration says it in its code, and reading the file gives you the value the expression
  produced -- `undefined`, for a variable that is not set in the process doing the reading. So a
  tool that needs to know *which* variable a setting reads has to look at the source.
*/
export function readEnvironmentReferences (source) {
  const { $ast: ast } = parseModule(source)
  const found = new Map()

  const declaration = ast.body.find(node => node.type === 'ExportDefaultDeclaration')?.declaration

  if (!declaration) {
    return found
  }

  // The plain-object form exports the configuration; a factory or `defineConfig` passes it along.
  const configuration = declaration.type === 'CallExpression' ? declaration.arguments[0] : declaration

  collectEnvironmentReferences(configuration, [], found)

  return found
}
