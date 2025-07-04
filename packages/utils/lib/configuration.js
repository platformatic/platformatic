import Ajv from 'ajv'
import { parse as parseJSON5, stringify as rawStringifyJSON5 } from 'json5'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, extname, resolve } from 'node:path'
import { parse as parseTOML, stringify as stringifyTOML } from 'toml'
import { parse as rawParseYAML, stringify as stringifyYAML } from 'yaml'
import {
  AddAModulePropertyToTheConfigOrAddAKnownSchemaError,
  CannotParseConfigFileError,
  ConfigurationDoesNotValidateAgainstSchemaError,
  InvalidConfigFileExtensionError,
  SourceMissingError
} from './errors.js'
import { isFileAccessible } from './file-system.js'
import { loadModule, splitModuleFromVersion } from './module.js'

export const knownConfigurationFilesExtensions = ['json', 'json5', 'yaml', 'yml', 'toml', 'tml']

// Important: do not put $ in any RegExp since we might use the querystring to deliver additional information
export const knownConfigurationFilesSchemas = [
  /^https:\/\/platformatic.dev\/schemas\/(?<version>)\/(?<module>.*)/,
  /^https:\/\/schemas.platformatic.dev\/@platformatic\/(?<module>.*)\/(?<version>)\.json/,
  /^https:\/\/schemas.platformatic.dev\/(?<module>wattpm)\/(?<version>)\.json/
]

function parseYAML (raw, ...args) {
  const bracesRegexp = /{(\d+|[a-z$_][\w\-$]*?(?:\.[\w\-$]*?)*?)}/gi
  const stringRegexp = /(["'])(?:(?=(\\?))\2.)*?\1/gi

  const stringMatches = [...raw.matchAll(stringRegexp)]

  raw = raw.replace(bracesRegexp, (match, p1, offset) => {
    for (const stringMatch of stringMatches) {
      const stringStart = stringMatch.index
      const stringEnd = stringMatch.index + stringMatch[0].length
      if (offset >= stringStart && offset <= stringEnd) return match
    }
    return `'${match}'`
  })

  return rawParseYAML(raw, ...args)
}

export function stringifyJSON (data) {
  return JSON.stringify(data, null, 2)
}

export function stringifyJSON5 (data) {
  return rawStringifyJSON5(data, null, 2)
}

export function getParser (path) {
  let parser

  switch (extname(path)) {
    case '.yaml':
    case '.yml':
      parser = parseYAML
      break
    case '.json':
      parser = JSON.parse
      break
    case '.json5':
      parser = parseJSON5
      break
    case '.toml':
    case '.tml':
      parser = parseTOML
      break
    default:
      throw new InvalidConfigFileExtensionError()
  }

  return parser
}

export function getStringifier (path) {
  let stringifer
  switch (extname(path)) {
    case '.yaml':
    case '.yml':
      stringifer = stringifyYAML
      break
    case '.json':
      stringifer = stringifyJSON
      break
    case '.json5':
      stringifer = stringifyJSON5
      break
    case '.toml':
    case '.tml':
      stringifer = stringifyTOML
      break
    default:
      throw new InvalidConfigFileExtensionError()
  }

  return stringifer
}

export function printValidationErrors (err) {
  const tabularData = err.validationmap(err => {
    return { path: err.path, message: err.message }
  })

  console.table(tabularData, ['path', 'message'])
}

export function listRecognizedConfigurationFiles (suffixes, extensions) {
  if (typeof suffixes === 'undefined' || suffixes === null) {
    suffixes = ['runtime', 'service', 'application', 'db', 'composer']
  } else if (suffixes && !Array.isArray(suffixes)) {
    suffixes = [suffixes]
  } else {
    suffixes = []
  }

  if (!extensions) {
    extensions = knownConfigurationFilesExtensions
  } else if (!Array.isArray(extensions)) {
    extensions = [extensions]
  }

  const files = []

  for (const ext of extensions) {
    files.push(`watt.${ext}`)
    files.push(`platformatic.${ext}`)
  }

  for (const suffix of suffixes) {
    for (const ext of extensions) {
      files.push(`watt.${suffix}.${ext}`)
      files.push(`platformatic.${suffix}.${ext}`)
    }
  }

  return files
}

export async function findConfigurationFile (root, suffixes, extensions, candidates) {
  if (!candidates) {
    candidates = listRecognizedConfigurationFiles(suffixes, extensions)
  }

  const existingFiles = await Promise.all(candidates.map(fileName => isFileAccessible(fileName, root)))
  return existingFiles.find(v => typeof v === 'string') || null
}

export function matchKnownSchema (config, throwOnMissing = false) {
  if (typeof config?.module === 'string') {
    return config.module
  } else if (typeof config?.$schema !== 'string') {
    if (throwOnMissing) {
      throw new AddAModulePropertyToTheConfigOrAddAKnownSchemaError()
    }

    return null
  }

  const matching = knownConfigurationFilesSchemas.map(matcher => config.$schema.match(matcher)).find(m => m)

  if (!matching && throwOnMissing) {
    throw new AddAModulePropertyToTheConfigOrAddAKnownSchemaError()
  }

  const mod = matching.groups.module
  const version = matching.groups.version

  return { module: `@platformatic/${mod === 'wattpm' ? 'runtime' : mod}`, version }
}

export async function searchConfigurationFile (root, configurationFile, schemas, suffixes) {
  if (schemas && !Array.isArray(schemas)) {
    schemas = [schemas]
  }

  let current = root

  const candidates = listRecognizedConfigurationFiles(suffixes)

  while (!configurationFile) {
    // Find a wattpm.json or watt.json file
    configurationFile = await findConfigurationFile(current, null, null, candidates)

    // If a file is found, verify it actually represents a watt or runtime configuration
    if (configurationFile) {
      const configuration = await loadConfigurationFile(resolve(current, configurationFile))

      if (schemas && !schemas.includes(matchKnownSchema(configuration)?.module)) {
        configurationFile = null
      }
    }

    if (!configurationFile) {
      const newCurrent = dirname(current)

      if (newCurrent === current) {
        break
      }

      current = newCurrent
    }
  }

  if (typeof configurationFile !== 'string') {
    return null
  }

  const resolved = resolve(current, configurationFile)
  return resolved
}

export async function loadConfigurationFile (configurationFile) {
  try {
    const parse = getParser(configurationFile)
    return parse(await readFile(configurationFile, 'utf-8'))
  } catch (error) {
    throw new CannotParseConfigFileError(configurationFile, error, { cause: error })
  }
}

export function saveConfigurationFile (configurationFile, config) {
  const stringifer = getStringifier(configurationFile)
  return writeFile(configurationFile, stringifer(config), 'utf-8')
}

export function createValidator (schema, validationOptions, options = {}) {
  const ajv = new Ajv(validationOptions)

  ajv.addKeyword({
    keyword: 'resolvePath',
    type: 'string',
    schemaType: 'boolean',
    // TODO@PI: figure out how to implement this via the new `code` option in Ajv
    validate: (schema, path, parentSchema, data) => {
      if (typeof path !== 'string' || path.trim() === '') {
        return !!parentSchema.allowEmptyPaths
      }

      if (options.fixPaths !== false) {
        const resolved = resolve(options.root, path)
        data.parentData[data.parentDataProperty] = resolved
      }
      return true
    }
  })

  ajv.addKeyword({ keyword: 'allowEmptyPaths', type: 'string', schemaType: 'boolean' })

  ajv.addKeyword({
    keyword: 'resolveModule',
    type: 'string',
    schemaType: 'boolean',
    // TODO@PI: figure out how to implement this via the new `code` option in Ajv
    validate: (_schema, path, _parentSchema, data) => {
      if (typeof path !== 'string' || path.trim() === '') {
        return false
      }

      if (options.fixPaths === false) {
        return true
      }

      const require = createRequire(resolve(options.root, 'noop.js'))
      try {
        const resolved = require.resolve(path)
        data.parentData[data.parentDataProperty] = resolved
        return true
      } catch {
        return false
      }
    }
  })

  ajv.addKeyword({
    keyword: 'typeof',
    validate: function validate (schema, value, _, data) {
      // eslint-disable-next-line valid-typeof
      if (typeof value === schema) {
        return true
      }

      validate.errors = [{ message: `"${data.parentDataProperty}" shoud be a ${schema}.`, params: data.parentData }]
      return false
    }
  })

  return ajv.compile(schema)
}

export function replaceEnv (config, onMissingEnv, path, rootObject) {
  // TODO@PI: Write me
}

export async function loadConfiguration (source, schema, options = {}) {
  const { validate, validationOptions, transform, upgrade, replaceEnv, onMissingEnv } = {
    validate: true,
    validationOptions: {},
    replaceEnv: true,
    ...options
  }

  if (typeof source === 'undefined') {
    throw new SourceMissingError()
  }

  let config = source
  if (typeof source === 'string') {
    config = await loadConfigurationFile(source)
  }

  config = structuredClone(source)

  if (replaceEnv) {
    config = replaceEnv(config, onMissingEnv, '')
  }

  if (upgrade) {
    let version = matchKnownSchema(config)?.version

    if (!version && config.module) {
      version = splitModuleFromVersion(config.module)
    }

    if (version) {
      config = await this.upgrade(config, version)
    }
  }

  if (validate) {
    if (typeof schema === 'undefined') {
      throw new SourceMissingError()
    }

    const validator = createValidator(schema, validationOptions)
    const valid = validator(config)

    if (!valid) {
      const error = new ConfigurationDoesNotValidateAgainstSchemaError()

      Object.defineProperty(error, 'validationErrors', {
        value: validator.errors.map(err => {
          return {
            path: err.instancePath === '' ? '/' : err.instancePath,
            message: err.message + ' ' + JSON.stringify(err.params)
          }
        })
      })

      throw error
    }
  }

  if (typeof transform === 'function') {
    config = await transform(config)
  }

  return config
}

export function loadCapability (root, config) {
  const pkg = matchKnownSchema(config, true)
  const require = createRequire(root, 'noop.js')
  return loadModule(require, pkg)
}
