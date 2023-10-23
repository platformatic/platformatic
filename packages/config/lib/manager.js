'use strict'

const { basename, join, resolve, dirname, parse } = require('node:path')
const { readFile, access } = require('node:fs/promises')
const EventEmitter = require('node:events')
const { createRequire } = require('node:module')
const Ajv = require('ajv')
const fastifyPlugin = require('./plugin')
const dotenv = require('dotenv')
const { request } = require('undici')
const { getParser, analyze, upgrade } = require('@platformatic/metaconfig')
const { isFileAccessible } = require('./utils')
const errors = require('./errors')

class ConfigManager extends EventEmitter {
  constructor (opts) {
    super()
    this.pupa = null
    this.envWhitelist = opts.envWhitelist || []
    if (!opts.source) {
      throw new errors.SourceMissingError()
    }

    this.validationErrors = []
    if (typeof opts.source === 'string') {
      this.fullPath = resolve(opts.source)
      const allowToWatch = opts.allowToWatch || []
      allowToWatch.push(basename(this.fullPath))
      this._parser = getParser(this.fullPath)
      this.dirname = dirname(this.fullPath)
    } else {
      this.current = opts.source
      this.dirname = opts.dirname || process.cwd()
    }

    this.schema = opts.schema || {}
    this.schemaOptions = opts.schemaOptions || {}
    this._providedSchema = !!opts.schema
    this._originalEnv = opts.env || {}
    this.env = this.purgeEnv(this._originalEnv)
    this._onMissingEnv = opts.onMissingEnv
    if (typeof opts.transformConfig === 'function') {
      this._transformConfig = opts.transformConfig
    }
  }

  toFastifyPlugin () {
    return async (app, opts) => {
      return fastifyPlugin(app, {
        ...opts,
        configManager: this
      })
    }
  }

  purgeEnv (providedEnvironment) {
    const env = {
      ...process.env,
      ...providedEnvironment
    }
    const purged = {}
    for (const key in env) {
      if (key.match(/^PLT_/) || this.envWhitelist.includes(key)) {
        purged[key] = env[key]
      }
    }
    return purged
  }

  async replaceEnv (configString) {
    /* istanbul ignore next */
    if (this.pupa === null) {
      this.pupa = (await import('pupa')).default
    }
    let dotEnvPath
    let currentPath = this.fullPath
    const rootPath = parse(this.fullPath).root
    while (currentPath !== rootPath) {
      try {
        const candidatePath = join(currentPath, '.env')
        await access(candidatePath)
        dotEnvPath = candidatePath
        break
      } catch {
        // Nothing to do
        currentPath = join(currentPath, '..')
      }
    }
    // try at last process.cwd()
    if (!dotEnvPath) {
      try {
        const cwdPath = join(process.cwd(), '.env')
        await access(cwdPath)
        dotEnvPath = cwdPath
      } catch {
        // do nothing, again
      }
    }
    let env = { ...this._originalEnv }
    if (dotEnvPath) {
      const data = await readFile(dotEnvPath, 'utf-8')
      const parsed = dotenv.parse(data)
      env = { ...env, ...parsed }
    }
    this.env = this.purgeEnv(env)

    const escapeJSONstring = ({ key, value }) => {
      if (!value && this._onMissingEnv) {
        value = this._onMissingEnv(key)
      }

      if (!value) {
        return value
      }

      // TODO this should handle all the escapes chars
      // defined in https://www.json.org/json-en.html
      // but it's good enough for now.
      return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n')
    }

    return this.pupa(configString, this.env, { transform: escapeJSONstring })
  }

  _transformConfig () {}

  async parse () {
    try {
      if (this.fullPath) {
        const configString = await this.load()
        this.current = this._parser(await this.replaceEnv(configString))
        // try updating the config format to latest
        try {
          let meta = await analyze({ config: this.current })
          meta = upgrade(meta)
          this.current = meta.config
        } catch {
          // nothing to do
        }
      }

      if (!this._providedSchema && this.current.$schema) {
        // The user did not provide a schema, but we have a link to the schema
        // in $schema. Try to fetch the schema and ignore anything that goes
        // wrong.
        try {
          const { body, statusCode } = await request(this.current.$schema)
          if (statusCode === 200) {
            this.schema = await body.json()
          }
          /* c8 ignore next 3 */
        } catch {
          // Ignore error.
        }
      }

      const validationResult = this.validate()
      if (!validationResult) {
        return false
      }
      await this._transformConfig()
      return true
    } catch (err) {
      if (err.name === 'MissingValueError') {
        if (!err.key.match(/^PLT_/) && !this.envWhitelist.includes(err.key)) {
          throw new errors.InvalidPlaceholderError(err.key, err.key)
        } else {
          throw new errors.EnvVarMissingError(err.key)
        }
      }
      const newerr = new errors.CannotParseConfigFileError(err.message)
      newerr.cause = err
      throw newerr
    }
  }

  validate () {
    if (!this.current) {
      return false
    }
    const ajv = new Ajv(this.schemaOptions)
    ajv.addKeyword({
      keyword: 'resolvePath',
      type: 'string',
      schemaType: 'boolean',
      // TODO: figure out how to implement this via the new `code`
      // option in Ajv
      validate: (schema, path, parentSchema, data) => {
        if (typeof path !== 'string' || path.trim() === '') {
          return false
        }
        const resolved = resolve(this.dirname, path)
        data.parentData[data.parentDataProperty] = resolved
        return true
      }
    })
    ajv.addKeyword({
      keyword: 'resolveModule',
      type: 'string',
      schemaType: 'boolean',
      // TODO: figure out how to implement this via the new `code`
      // option in Ajv
      validate: (schema, path, parentSchema, data) => {
        if (typeof path !== 'string' || path.trim() === '') {
          return false
        }
        const toRequire = this.fullPath || join(this.dirname, 'foo')
        const _require = createRequire(toRequire)
        try {
          const resolved = _require.resolve(path)
          data.parentData[data.parentDataProperty] = resolved
          return true
        } catch {
          return false
        }
      }
    })
    const ajvValidate = ajv.compile(this.schema)

    const res = ajvValidate(this.current)
    /* c8 ignore next 12 */
    if (!res) {
      this.validationErrors = ajvValidate.errors.map((err) => {
        return {
          path: err.instancePath === '' ? '/' : err.instancePath,
          message: err.message + ' ' + JSON.stringify(err.params)
        }
      })
      return false
    }
    return true
  }

  /* c8 ignore next 8 */
  async parseAndValidate () {
    const validationResult = await this.parse()
    if (!validationResult) {
      throw new errors.ValidationErrors(this.validationErrors.map((err) => {
        return err.message
      }).join('\n'))
    }
  }

  async update (newConfig) {
    const _old = { ...this.current }
    this.current = newConfig
    if (!this.validate()) {
      this.current = _old
      return false
    }
    await this._transformConfig()
    this.emit('update', this.current)
    return true
  }

  async load () {
    const configString = await readFile(this.fullPath, 'utf-8')
    return configString
  }

  static listConfigFiles (type) {
    if (type) {
      // A config type (service, db, etc.) was explicitly provided.
      return [
        `platformatic.${type}.json`,
        `platformatic.${type}.json5`,
        `platformatic.${type}.yaml`,
        `platformatic.${type}.yml`,
        `platformatic.${type}.toml`,
        `platformatic.${type}.tml`
      ]
    } else {
      // A config type was not provided. Search for all known types and
      // formats. Unfortunately, this means the ConfigManager needs to be
      // aware of the different application types (but that should be small).
      return [
        ...this.listConfigFiles('service'),
        ...this.listConfigFiles('db'),
        ...this.listConfigFiles('composer'),
        ...this.listConfigFiles('runtime')
      ]
    }
  }

  static async findConfigFile (directory, type) {
    directory ??= process.cwd()
    const configFileNames = this.listConfigFiles(type)
    const configFilesAccessibility = await Promise.all(configFileNames.map((fileName) => isFileAccessible(fileName, directory)))
    const accessibleConfigFilename = configFileNames.find((value, index) => configFilesAccessibility[index])
    return accessibleConfigFilename
  }
}

module.exports.ConfigManager = ConfigManager
