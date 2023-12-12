'use strict'

const { mkdir } = require('node:fs/promises')
const { WrongTypeError } = require('./errors')
const { join } = require('node:path')
const PLT_ROOT = 'PLT_ROOT'

async function safeMkdir (dir) {
  try {
    await mkdir(dir, { recursive: true })
    /* c8 ignore next 3 */
  } catch (err) {
    // do nothing
  }
}

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
function addPrefixToEnv (env, prefix) {
  const newEnv = {}
  if (!prefix) {
    // return original env
    return env
  }
  const prefixRegExp = new RegExp(`^PLT_${prefix}_`)
  Object.entries(env).forEach((kv) => {
    if (!kv[0].match(prefixRegExp)) {
      // strip PLT_ if needed
      kv[0] = kv[0].replace(/^PLT_/, '')
      newEnv[`PLT_${prefix}_${kv[0]}`] = kv[1]
    } else {
      newEnv[kv[0]] = kv[1]
    }
  })
  return newEnv
}

function envObjectToString (env) {
  const output = []
  Object.entries(env).forEach((kv) => {
    output.push(`${kv[0]}=${kv[1]}`)
  })
  return output.join('\n')
}

function extractEnvVariablesFromText (text) {
  const match = text.match(/\{[a-zA-Z0-9-_]*\}/g)
  if (match) {
    return match
      .map((found) => found.replace('{', '').replace('}', ''))
      .filter((found) => found !== '')
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
          case 'string' :
            value = param.value.toString()
            break
          case 'number':
            value = parseInt(param.value)
            break
          case 'boolean':
            value = (param.value === 'true')
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
module.exports = {
  addPrefixToEnv,
  addPrefixToString,
  convertServiceNameToPrefix,
  getPackageConfigurationObject,
  envObjectToString,
  extractEnvVariablesFromText,
  safeMkdir,
  stripVersion,
  PLT_ROOT
}
