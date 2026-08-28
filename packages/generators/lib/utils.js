import {
  listDirectoryEntries,
  selectConfigurationFileNames,
  selectLegacyConfigurationFileNames
} from '@platformatic/foundation/lib/v4/index.js'
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
