'use strict'

const { extname, join, resolve, dirname } = require('path')
const { readFile, watch, writeFile, access } = require('fs/promises')
const { tmpdir } = require('os')
const EventEmitter = require('events')
const Ajv = require('ajv')
const fastifyPlugin = require('./lib/plugin')
const YAML = require('yaml')
const TOML = require('@iarna/toml')
const JSON5 = require('json5')
const dotenv = require('dotenv')
const minimatch = require('minimatch')
class ConfigManager extends EventEmitter {
  constructor (opts) {
    super()
    this.watchIgnore = opts.watchIgnore || []
    this.pupa = null
    this.abortController = null
    this._shouldSave = false
    this.envWhitelist = opts.envWhitelist || []
    if (!opts.source) {
      throw new Error('Source missing.')
    }

    this.validationErrors = []
    if (typeof opts.source === 'string') {
      this.fullPath = resolve(opts.source)
    } else {
      this.fullPath = join(tmpdir(), `platformatic-db-config-${Date.now()}.json`)
      this.current = opts.source
      this._shouldSave = true
    }
    this.serializer = this.getSerializer()
    this.schema = opts.schema || {}
    this.schemaOptions = opts.schemaOptions || {}
    this._originalEnv = opts.env || {}
    this.env = this.purgeEnv(this._originalEnv)
    /* c8 ignore next 3 */
    if (opts.watch) {
      this.startWatch()
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

  async stopWatch () {
    if (!this.abortController) {
      return
    }
    this.abortController.abort()
    this.abortController = false
    await this._watcher.catch(() => {})
  }

  startWatch () {
    if (this.abortController) {
      return this._watcher
    }
    this.abortController = new AbortController()
    const { signal } = this.abortController
    const watcher = watch(dirname(this.fullPath), { signal, recursive: true })
    let timer = null
    const refresh = async () => {
      timer = null
      try {
        await this.parseAndValidate()
        this.emit('update', this.current)
      } catch (err) {
        this.emit('error', err)
      }
    }

    const loop = async () => {
      for await (const event of watcher) {
        if (timer) {
          continue
        }

        // eventType can be both 'change' and 'rename'
        /* c8 ignore next 1 */
        if (event.eventType === 'change' || event.eventType === 'rename') {
          if (this.shouldFileBeWatched(event.filename)) {
            timer = setTimeout(refresh, 100)
          }
        }
      }
      /* c8 ignore next 1 */
    }

    this._watcher = loop()
    return this._watcher
  }

  getSerializer () {
    switch (extname(this.fullPath)) {
      case '.yaml':
      case '.yml':
        return YAML
      case '.json':
        return {
          parse: (json) => JSON.parse(json),
          stringify: (data) => JSON.stringify(data, null, 2)
        }
      case '.json5':
        return {
          parse: (json) => JSON5.parse(json),
          stringify: (data) => JSON5.stringify(data, null, 2)
        }
      case '.toml':
        return TOML
      default:
        throw new Error('Invalid config file extension. Only yml, yaml, json, json5, toml are supported.')
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
    if (this.pupa === null) {
      this.pupa = (await import('pupa')).default
    }
    const paths = [
      join(dirname(this.fullPath), '.env'),
      join(process.cwd(), '.env')
    ]
    let dotEnvPath
    for (const p of paths) {
      try {
        await access(p)
        dotEnvPath = p
        break
      } catch {
        // Nothing to do
      }
    }
    let env = { ...this._originalEnv }
    if (dotEnvPath) {
      const data = await readFile(dotEnvPath, 'utf-8')
      const parsed = dotenv.parse(data)
      env = { ...env, ...parsed }
    }
    this.env = this.purgeEnv(env)
    return this.pupa(configString, this.env)
  }

  _transformConfig () {}

  _sanitizeConfig () {
    return this.current
  }

  async parse () {
    try {
      if (this._shouldSave) {
        await this.save()
        this._shouldSave = false
      }
      const configString = await this.load()
      this.current = this.serializer.parse(await this.replaceEnv(configString))
      const validationResult = this.validate()
      if (!validationResult) {
        return false
      }
      this._transformConfig()
      return true
    } catch (err) {
      if (err.name === 'MissingValueError') {
        if (!err.key.match(/^PLT_/) && !this.envWhitelist.includes(err.key)) {
          throw new Error(`${err.key} is an invalid placeholder. All placeholders must be prefixed with PLT_.\nDid you mean PLT_${err.key}?`)
        } else {
          throw new Error(`${err.key} env variable is missing.`)
        }
      }
      throw new Error(`Cannot parse config file. ${err.message}`)
    }
  }

  validate () {
    if (!this.current) {
      return false
    }
    const ajv = new Ajv(this.schemaOptions)
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

  async parseAndValidate () {
    const validationResult = await this.parse()
    if (!validationResult) {
      throw new Error(this.validationErrors.map((err) => {
        return err.message
      }).join('\n'))
    }
  }

  async update (newConfig) {
    const _old = { ...this.current }
    this.current = newConfig
    if (this.validate()) {
      return this.save()
    }
    this.current = _old
    return false
  }

  async save () {
    if (!this.current) {
      return false
    }
    const sanitizedConfig = this._sanitizeConfig()
    return await writeFile(this.fullPath, this.serializer.stringify(sanitizedConfig))
  }

  async load () {
    const configString = await readFile(this.fullPath, 'utf-8')
    return configString
  }

  shouldFileBeWatched (fileName) {
    let found = true
    for (const ignoredFile of this.watchIgnore) {
      if (minimatch(fileName, ignoredFile)) {
        found = false
        break
      }
    }
    return found
  }
}

module.exports = ConfigManager
