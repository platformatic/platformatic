'use strict'

const { createRequire } = require('@platformatic/utils')
const { basename, join, resolve, dirname, parse, isAbsolute } = require('node:path')
const { readFile, access } = require('node:fs/promises')
const EventEmitter = require('node:events')
const Ajv = require('ajv')
const jsonPath = require('jsonpath')
const dotenv = require('dotenv')
const fastifyPlugin = require('./plugin')
const { getParser } = require('./formats')
const { isFileAccessible, splitModuleFromVersion } = require('./utils')
const errors = require('./errors')
const abstractlogger = require('./logger')

const PLT_ROOT = 'PLT_ROOT'

const skipReplaceEnv = Symbol('skipReplaceEnv')

class ConfigManager extends EventEmitter {
  constructor (opts) {
    super()
    this.pupa = null
    this._stackableUpgrade = opts.upgrade
    this._fixPaths = opts.fixPaths === undefined ? true : opts.fixPaths
    this._configVersion = opts.configVersion // requested version
    this._version = opts.version
    this.logger = opts.logger || abstractlogger

    if (this._stackableUpgrade && !this._version) {
      throw new errors.VersionMissingError()
    }

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
    this._replaceEnvIgnore = opts.replaceEnvIgnore || []
    this._originalEnv = opts.env || {}
    this.context = opts.context || {}
    this.env = { ...this._originalEnv }
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

  async replaceEnv (config, opts = {}) {
    /* istanbul ignore next */
    if (this.pupa === null) {
      this.pupa = (await import('pupa')).default
    }

    if (opts.ignore !== undefined) {
      for (const path of opts.ignore) {
        jsonPath.apply(config, path, value => {
          value[skipReplaceEnv] = true
          return value
        })
      }
    }

    const escapeJSON = opts.escapeJSON ?? true
    const env = opts.env ?? (await this.#loadEnv())

    if (typeof config === 'object' && config !== null) {
      if (config[skipReplaceEnv]) {
        delete config[skipReplaceEnv]
        return config
      }

      for (const key of Object.keys(config)) {
        const value = config[key]
        config[key] = await this.replaceEnv(value, {
          env,
          context: opts.context,
          escapeJSON: false,
          parent: config,
          tree: [...(opts.tree ?? []), config]
        })
      }
      return config
    }

    const replaceEnv = ({ key, value }) => {
      if (!value && this._onMissingEnv) {
        value = this._onMissingEnv(key, opts)
      }

      /*
        When the value is undefined, which means that the key was missing,
        just replace with an empty string. The JSON schema will eventually throw an error.
      */
      if (typeof value === 'undefined') {
        value = ''
      }

      // TODO this should handle all the escapes chars
      // defined in https://www.json.org/json-en.html
      // but it's good enough for now.
      if (value && escapeJSON) {
        value = value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n')
      }

      return value
    }

    if (typeof config === 'string') {
      return this.pupa(config, env, { transform: replaceEnv })
    }

    return config
  }

  _transformConfig () { }

  async parse (replaceEnv = true, args = [], opts = {}) {
    let valid = true

    try {
      if (this.fullPath) {
        const configString = await this.load()

        let config = this._parser(configString)
        if (replaceEnv) {
          config = await this.replaceEnv(config, {
            escapeJSON: false,
            ignore: this._replaceEnvIgnore,
            context: this.context
          })
        }

        this.current = config
      } else if (replaceEnv) {
        this.current = await this.replaceEnv(this.current, {
          escapeJSON: false,
          ignore: this._replaceEnvIgnore,
          context: this.context
        })
      }

      if (this._stackableUpgrade) {
        if (!this._configVersion && (this.current.extends || this.current.module)) {
          const { version } = splitModuleFromVersion(this.current.extends || this.current.module)
          this._configVersion = version
        }

        let version = this._configVersion
        if (!version && this.current.$schema?.indexOf('https://platformatic.dev/schemas/') === 0) {
          const url = new URL(this.current.$schema)
          const res = url.pathname.match(/^\/schemas\/v(\d+\.\d+\.\d+)(?:-\w+\.\d+)?\/(.*)$/)
          version = res[1]
        }

        /* c8 ignore next 5 - Not used */
        if (!version && this.current.$schema?.indexOf('https://schemas.platformatic.dev/@platformatic/') === 0) {
          const url = new URL(this.current.$schema)
          const res = url.pathname.match(/^\/@platformatic\/[^/]+\/(\d+\.\d+\.\d+(?:-[^/]+)?)\.json$/)
          version = res[1]
        }

        // Really old Platformatic applications followed this format. This was a bad decision that we
        // keep supporting.
        // TODO(mcollina): remove in a future version
        if (!version && this.fullPath && this.current.$schema && this.current.$schema.indexOf('./') === 0) {
          const dir = dirname(this.fullPath)
          try {
            const schemaPath = resolve(dir, this.current.$schema)
            const schema = JSON.parse(await readFile(schemaPath, 'utf-8'))
            if (schema.$id?.indexOf('https://schemas.platformatic.dev') === 0) {
              version = '0.15.0'
            }
          } catch {
            if (this.current.server) {
              version = '0.15.0'
            }
          }
        }

        // If we can't find a version, then we can't upgrade
        if (version) {
          this.current = await this._stackableUpgrade(this.current, version)

          if (this.current.extends) {
            this.current.extends.replace(/.+@(\d+\.\d+\.\d+)$/, this._version)
          }
          if (this.current.module) {
            this.current.module.replace(/.+@(\d+\.\d+\.\d+)$/, this._version)
          }
        }
      }

      if (opts.validation !== false) {
        const validationResult = this.validate()
        if (!validationResult) {
          valid = false

          if (!opts.transformOnValidationErrors) {
            return valid
          }
        }
      }

      if (opts.transform !== false) {
        await this._transformConfig(args)
      }

      return valid
    } catch (err) {
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
          return !!parentSchema.allowEmptyPaths
        }

        if (this._fixPaths) {
          const resolved = resolve(this.dirname, path)
          data.parentData[data.parentDataProperty] = resolved
        }
        return true
      }
    })
    ajv.addKeyword({
      keyword: 'allowEmptyPaths',
      type: 'string',
      schemaType: 'boolean'
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
        if (!this._fixPaths) {
          return true
        }
        const toRequire = this.fullPath || join(this.dirname, 'noop.js')
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

    const ajvValidate = ajv.compile(this.schema)

    const res = ajvValidate(this.current)
    /* c8 ignore next 12 */
    if (!res) {
      this.validationErrors = ajvValidate.errors.map(err => {
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
  async parseAndValidate (replaceEnv = true) {
    const validationResult = await this.parse(replaceEnv)
    if (!validationResult) {
      throw new errors.ValidationErrors(
        this.validationErrors.map(err => { return err.message }).join('\n')
      )
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
        ...(typeof type === 'string'
          ? new Set([
            `platformatic.${type}.json`,
            `platformatic.${type}.json5`,
            `platformatic.${type}.yaml`,
            `platformatic.${type}.yml`,
            `platformatic.${type}.toml`,
            `platformatic.${type}.tml`
          ])
          : []),
        ...new Set([
          'platformatic.json',
          'platformatic.json5',
          'platformatic.yaml',
          'platformatic.yml',
          'platformatic.toml',
          'platformatic.tml',
          'watt.json',
          'watt.json5',
          'watt.yaml',
          'watt.yml',
          'watt.toml',
          'watt.tml'
        ])
      ]
    } else {
      // A config type was not provided. Search for all known types and
      // formats. Unfortunately, this means the ConfigManager needs to be
      // aware of the different application types (but that should be small).
      return [
        ...new Set([
          ...this.listConfigFiles('application'),
          ...this.listConfigFiles('service'),
          ...this.listConfigFiles('db'),
          ...this.listConfigFiles('composer'),
          ...this.listConfigFiles('runtime')
        ])
      ]
    }
  }

  static async findConfigFile (directory, typeOrCandidates) {
    directory ??= process.cwd()
    const configFileNames = Array.isArray(typeOrCandidates) ? typeOrCandidates : this.listConfigFiles(typeOrCandidates)
    const configFilesAccessibility = await Promise.all(
      configFileNames.map(fileName => isFileAccessible(fileName, directory))
    )
    const accessibleConfigFilename = configFileNames.find((value, index) => configFilesAccessibility[index])
    return accessibleConfigFilename
  }

  async #loadEnv () {
    let dotEnvPath
    let currentPath = this.fullPath ?? this.dirname

    if (!isAbsolute(currentPath)) {
      currentPath = resolve(process.cwd(), currentPath)
    }

    const rootPath = parse(currentPath).root

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
    this.env = env

    return {
      ...process.env,
      ...this.env,
      [PLT_ROOT]: this.fullPath ? join(this.fullPath, '..') : this.dirname
    }
  }
}

module.exports.ConfigManager = ConfigManager
