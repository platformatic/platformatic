'use strict'

const { mkdir } = require('node:fs/promises')

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

function addPrefixToEnv (env, prefix) {
  const newEnv = {}
  const prefixRegExp = new RegExp(`^PLT_${prefix}_`)
  Object.entries(env).forEach((kv) => {
    if (!kv[0].match(prefixRegExp)) {
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

module.exports = {
  addPrefixToEnv,
  convertServiceNameToPrefix,
  envObjectToString,
  extractEnvVariablesFromText,
  safeMkdir,
  stripVersion
}
