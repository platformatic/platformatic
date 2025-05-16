'use strict'

const { WrongTypeError } = require('./errors')
const { join } = require('node:path')
const { request } = require('undici')
const { setTimeout } = require('timers/promises')
const PLT_ROOT = 'PLT_ROOT'
const { EOL } = require('node:os')
const { createDirectory } = require('@platformatic/utils')

/**
 * Strip all extra characters from a simple semver version string
 * @param {string} version
 * @returns string
 */
function stripVersion (version) {
  const match = version.match(/(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)/)
  if (match) {
    return match[0]
  }
  /* c8 ignore next */
  return version
}

function convertServiceNameToPrefix (serviceName) {
  return serviceName.replace(/-/g, '_').toUpperCase()
}

function addPrefixToString (input, prefix) {
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

function envObjectToString (env) {
  const output = []
  Object.entries(env).forEach(kv => {
    output.push(`${kv[0]}=${kv[1]}`)
  })
  return output.join(EOL)
}

function envStringToObject (envString) {
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
function extractEnvVariablesFromText (text) {
  const match = text.match(/\{[a-zA-Z0-9-_]*\}/g)
  if (match) {
    return match.map(found => found.replace('{', '').replace('}', '')).filter(found => found !== '')
  }
  return []
}
function getPackageConfigurationObject (config, serviceName = '') {
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
          const key = addPrefixToString(param.name, convertServiceNameToPrefix(serviceName))
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

async function getLatestNpmVersion (pkg) {
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
function flattenObject (ob) {
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

function getServiceTemplateFromSchemaUrl (schemaUrl) {
  const splitted = schemaUrl.split('/')

  /* c8 ignore next 3 - Legacy interface */
  if (schemaUrl.startsWith('https://platformatic.dev/schemas')) {
    return `@platformatic/${splitted[splitted.length - 1]}`
  }
  return `@platformatic/${splitted[splitted.length - 2]}`
}

module.exports = {
  addPrefixToString,
  convertServiceNameToPrefix,
  getPackageConfigurationObject,
  envObjectToString,
  envStringToObject,
  extractEnvVariablesFromText,
  flattenObject,
  getServiceTemplateFromSchemaUrl,
  createDirectory,
  stripVersion,
  PLT_ROOT,
  getLatestNpmVersion
}
