import toml from '@iarna/toml'
import Ajv from 'ajv'
import JSON5 from 'json5'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, extname, resolve } from 'node:path'
import { parse as rawParseYAML, stringify as stringifyYAML } from 'yaml'
import {
  AddAModulePropertyToTheConfigOrAddAKnownSchemaError,
  CannotParseConfigFileError,
  ConfigurationDoesNotValidateAgainstSchemaError,
  InvalidConfigFileExtensionError,
  RootMissingError,
  SourceMissingError
} from './errors.js'
import { isFileAccessible } from './file-system.js'
import { loadModule, splitModuleFromVersion } from './module.js'
import { kMetadata } from './symbols.js'

const { parse: parseJSON5, stringify: rawStringifyJSON5 } = JSON5
const { parse: parseTOML, stringify: stringifyTOML } = toml

export const knownConfigurationFilesExtensions = ['json', 'json5', 'yaml', 'yml', 'toml', 'tml']

// Important: do not put $ in any RegExp since we might use the querystring to deliver additional information
export const knownConfigurationFilesSchemas = [
  /^https:\/\/platformatic.dev\/schemas\/(v?)(?<version>[^/]+)\/(?<module>.*)/,
  /^https:\/\/schemas.platformatic.dev\/@platformatic\/(?<module>.*)\/(v?)(?<version>[^/]+)\.json/,
  /^https:\/\/schemas.platformatic.dev\/(?<module>wattpm)\/(v?)(?<version>[^/]+)\.json/
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
  const tabularData = err.validation.map(err => {
    return { path: err.path, message: err.message }
  })

  console.table(tabularData, ['path', 'message'])
}

export function listRecognizedConfigurationFiles (suffixes, extensions) {
  if (typeof suffixes === 'undefined' || suffixes === null) {
    // composer is retained for backward compatibility with V2
    suffixes = ['runtime', 'service', 'application', 'db', 'gateway', 'composer']
  } else if (suffixes && !Array.isArray(suffixes)) {
    suffixes = [suffixes]
  } else if (!suffixes) {
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

export function extractModuleFromSchemaUrl (config, throwOnMissing = false) {
  if (typeof config?.module === 'string') {
    return config
  } else if (typeof config?.$schema !== 'string') {
    if (throwOnMissing) {
      throw new AddAModulePropertyToTheConfigOrAddAKnownSchemaError()
    }

    return null
  }

  const matching = knownConfigurationFilesSchemas.map(matcher => config.$schema.match(matcher)).find(m => m)

  if (!matching) {
    if (throwOnMissing) {
      throw new AddAModulePropertyToTheConfigOrAddAKnownSchemaError()
    }

    return null
  }

  const mod = matching.groups.module
  const version = matching.groups.version

  return { module: `@platformatic/${mod === 'wattpm' ? 'runtime' : mod}`, version }
}

export async function findConfigurationFile (root, suffixes, extensions, candidates) {
  if (!candidates) {
    candidates = listRecognizedConfigurationFiles(suffixes, extensions)
  }

  const existingFiles = await Promise.all(
    candidates.map(async fileName => {
      const accessible = await isFileAccessible(fileName, root)
      return accessible ? fileName : null
    })
  )
  return existingFiles.find(v => v !== null) || null
}

export async function findConfigurationFileRecursive (root, configurationFile, schemas, suffixes) {
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

      if (schemas) {
        const schemaMatch = extractModuleFromSchemaUrl(configuration)
        /* c8 ignore next - else */
        const moduleMatch = typeof schemaMatch === 'string' ? schemaMatch : schemaMatch?.module
        if (!schemas.includes(moduleMatch)) {
          configurationFile = null
        }
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

export function createValidator (schema, validationOptions, context = {}) {
  const ajv = new Ajv(validationOptions)

  ajv.addKeyword({
    keyword: 'resolvePath',
    type: 'string',
    schemaType: 'boolean',
    // TODO@ShogunPanda: figure out how to implement this via the new `code` option in Ajv
    validate: (schema, path, parentSchema, data) => {
      if (typeof path !== 'string' || path.trim() === '') {
        return !!parentSchema.allowEmptyPaths
      }

      if (context.fixPaths !== false) {
        const resolved = resolve(context.root, path)
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
    // TODO@ShogunPanda: figure out how to implement this via the new `code` option in Ajv
    validate: (_schema, path, _parentSchema, data) => {
      if (typeof path !== 'string' || path.trim() === '') {
        return false
      }

      if (context.fixPaths === false) {
        return true
      }

      const require = createRequire(resolve(context.root, 'noop.js'))
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

export function validate (schema, config, validationOptions = {}, fixPaths = true, root = '') {
  const validator = createValidator(schema, validationOptions, { root, fixPaths })
  const valid = validator(config)

  if (!valid) {
    const validationErrors = []
    let errors = ':'

    for (const validationError of validator.errors) {
      /* c8 ignore next - else */
      const path = validationError.instancePath === '' ? '/' : validationError.instancePath

      validationErrors.push({ path, message: validationError.message, params: validationError.params })
      errors += `\n  - ${path}: ${validationError.message}`
    }

    const error = new ConfigurationDoesNotValidateAgainstSchemaError()
    error.message += errors + '\n'
    Object.defineProperty(error, 'validationErrors', { value: validationErrors })

    throw error
  }
}

/*
  What remains of the v3 reader: parse a serialized configuration, run its capability's `upgrade`
  chain, validate it, and hand it to `transform`.

  It does not resolve an environment and does not substitute `{PLT_X}`. Those went with the format:
  a v4 configuration is a program that reads `process.env` itself, and the loader resolves every
  application's environment main-side, exactly once. What is left here reads the documents that are
  deliberately still v3 -- the upgrade chains, which exist to be old -- and nothing else.
*/
export async function loadConfiguration (source, schema, options = {}) {
  const {
    validate: shouldValidate,
    validationOptions,
    transform,
    upgrade,
    env: additionalEnv,
    fixPaths,
    logger,
    skipMetadata
  } = {
    validate: !!schema,
    validationOptions: {},
    fixPaths: true,
    ...options
  }

  let root = options.root

  if (typeof source === 'undefined') {
    throw new SourceMissingError()
  }

  let config = source
  if (typeof source === 'string') {
    root = dirname(source)
    config = await loadConfigurationFile(source)
  }

  if (!root) {
    throw new RootMissingError()
  }

  const env = { ...additionalEnv }

  const moduleInfo = extractModuleFromSchemaUrl(config)

  if (upgrade) {
    let version = moduleInfo?.version

    if (!version && config.module) {
      version = splitModuleFromVersion(config.module).version
    }

    if (version) {
      config = await upgrade(logger, config, version)
    }
  }

  if (shouldValidate) {
    if (typeof schema === 'undefined') {
      throw new SourceMissingError()
    }

    validate(schema, config, validationOptions, fixPaths, root)
  }

  if (!skipMetadata) {
    config[kMetadata] = {
      root,
      env,
      path: typeof source === 'string' ? source : null,
      module: moduleInfo?.module ?? null
    }
  }

  if (typeof transform === 'function') {
    try {
      config = await transform(config, schema, options)
    } catch (error) {
      throw new CannotParseConfigFileError(error.message, { cause: error })
    }
  }

  return config
}

export async function loadConfigurationModule (root, config, pkg) {
  pkg ??= extractModuleFromSchemaUrl(config, true).module

  try {
    const require = createRequire(resolve(root, 'noop.js'))
    return await loadModule(require, pkg)
  } catch (error) { // Fallback to the one bundled with Platformatic runtime
    const require = createRequire(import.meta.filename)
    return loadModule(require, pkg)
  }
}
