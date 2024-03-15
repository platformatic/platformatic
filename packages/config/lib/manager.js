'use strict'

const { basename, join, resolve, dirname, parse } = require('node:path')
const { readFile, access } = require('node:fs/promises')
const EventEmitter = require('node:events')
const { createRequire } = require('node:module')
const Ajv = require('ajv')
const fastifyPlugin = require('./plugin')
const dotenv = require('dotenv')
const { getParser } = require('./formats')
const { isFileAccessible, splitModuleFromVersion } = require('./utils')
const errors = require('./errors')
const abstractlogger = require('./logger')

const PLT_ROOT = 'PLT_ROOT'

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

    this.envWhitelist = opts.envWhitelist || []
    if (typeof this.envWhitelist === 'string') {
      this.envWhitelist = opts.envWhitelist.split(',')
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
      if (this.#isEnvVariable(key)) {
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
    const fullEnv = {
      ...this.env,
      [PLT_ROOT]: join(this.fullPath, '..')
    }
    return this.pupa(configString, fullEnv, { transform: escapeJSONstring })
  }

  /**
   * Checks if a key starts with `PLT_` or is in the whitelist.
   * With respect for wildcard ala `MY_NS_*`
   * @param {string} key
   */
  #isEnvVariable (key) {
    const isInWhitelist = this.envWhitelist.some((whitelisted) =>
      (whitelisted.endsWith('*') && key.startsWith(whitelisted.slice(0, -1))) || whitelisted === key
    )

    return key.startsWith('PLT_') || isInWhitelist
  }

  _transformConfig () {}

  async parse (replaceEnv = true) {
    try {
      if (this.fullPath) {
        const configString = await this.load()
        if (replaceEnv) {
          this.current = this._parser(await this.replaceEnv(configString))
        } else {
          this.current = this._parser(await this.load())
        }
      }

      if (this._stackableUpgrade) {
        if (!this._configVersion && (this.current.extends || this.current.module)) {
          const { version } = splitModuleFromVersion(this.current.extends || this.current.module)
          this._configVersion = version
        }

        let version = this._configVersion
        if (!version && this.current.$schema?.indexOf('https://platformatic.dev/schemas/') === 0) {
          const url = new URL(this.current.$schema)
          const res = url.pathname.match(/^\/schemas\/v(\d+\.\d+\.\d+)\/(.*)$/)
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

      const validationResult = this.validate()
      if (!validationResult) {
        return false
      }

      await this._transformConfig()
      return true
    } catch (err) {
      if (err.name === 'MissingValueError') {
        if (!this.#isEnvVariable(err.key)) {
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

        if (this._fixPaths) {
          const resolved = resolve(this.dirname, path)
          data.parentData[data.parentDataProperty] = resolved
        }
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
        if (!this._fixPaths) {
          return true
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

    ajv.addKeyword({
      keyword: 'typeof',
      validate: function validate (schema, value, _, data) {
        // eslint-disable-next-line valid-typeof
        if (typeof value === schema) { return true }
        validate.errors = [{ message: `"${data.parentDataProperty}" shoud be a ${schema}.`, params: data.parentData }]
        return false
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
        `platformatic.${type}.tml`,
        'platformatic.json',
        'platformatic.json5',
        'platformatic.yaml',
        'platformatic.yml',
        'platformatic.toml',
        'platformatic.tml'
      ]
    } else {
      // A config type was not provided. Search for all known types and
      // formats. Unfortunately, this means the ConfigManager needs to be
      // aware of the different application types (but that should be small).
      return [...new Set([
        ...this.listConfigFiles('service'),
        ...this.listConfigFiles('db'),
        ...this.listConfigFiles('composer'),
        ...this.listConfigFiles('runtime')
      ])]
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
