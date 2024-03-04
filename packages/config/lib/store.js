'use strict'

const { createRequire } = require('node:module')
const { isFileAccessible } = require('./utils')
const { join } = require('node:path')
const { ConfigManager } = require('./manager')
const { readFile } = require('node:fs/promises')
const { readFileSync } = require('node:fs')
const { getParser, analyze, upgrade } = require('@platformatic/metaconfig')
const errors = require('./errors')

const pltVersion = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8')).version

class Store {
  #map = new Map()
  #cwd
  #require

  constructor (opts) {
    opts = opts || {}
    this.#cwd = opts.cwd || process.cwd()

    // createRequire accepts a filename, but it's not used,
    // so we pass a dummy file to make it happy
    this.#require = createRequire(join(this.#cwd, 'noop.js'))
  }

  add (app) {
    if (typeof app !== 'function') {
      throw new errors.AppMustBeAFunctionError()
    }

    if (app.schema === undefined) {
      throw new errors.SchemaMustBeDefinedError()
    }

    if (typeof app.schema.$id !== 'string' || app.schema.$id.length === 0) {
      throw new errors.SchemaIdMustBeAStringError()
    }

    if (typeof app.configType !== 'string') {
      throw new errors.ConfigTypeMustBeAStringError()
    }
    // TODO validate configType being unique

    if (app.configManagerConfig === undefined) {
      app.configManagerConfig = {}
    } else {
      app.configManagerConfig.schema = app.schema
    }

    this.#map.set(app.schema.$id, app)
  }

  async get ({ $schema, module, extends: _extends }, { directory } = {}) {
    // We support both 'module' and 'extends'. Note that we have to rename the veriable, because "extends" is a reserved word
    const extendedModule = _extends || module
    let app = this.#map.get($schema)
    let require = this.#require

    if (directory) {
      require = createRequire(join(directory, 'noop.js'))
    }

    // try to load module
    if (!app && extendedModule) {
      try {
        app = require(extendedModule)
      } catch (err) {
        if (err.code === 'ERR_REQUIRE_ESM') {
          const toLoad = require.resolve(extendedModule)
          app = (await import('file://' + toLoad)).default
        } else {
          throw err
        }
      }
    }

    if (app === undefined) {
      const attemptedToRunVersion = this.getVersionFromSchema($schema)

      if (attemptedToRunVersion === null) {
        throw new errors.AddAModulePropertyToTheConfigOrAddAKnownSchemaError()
      } else {
        throw new errors.VersionMismatchError(pltVersion, attemptedToRunVersion)
      }
    }

    return app
  }

  getVersionFromSchema (schema) {
    if (!schema) {
      return null
    }
    const match = schema.match(/\/schemas\/(.*)\//)
    if (match) {
      return match[1]
    }
    return null
  }

  listTypes () {
    const knownTypes = Array.from(this.#map.entries()).map(([id, app]) => {
      return {
        id,
        configType: app.configType
      }
    })

    return knownTypes
  }

  async #findConfigFile (directory) {
    directory ??= this.#cwd
    const types = this.listTypes()

    for (const _ of types) {
      const type = _.configType
      _.filenames = [
        `platformatic.${type}.json`,
        `platformatic.${type}.json5`,
        `platformatic.${type}.yaml`,
        `platformatic.${type}.yml`,
        `platformatic.${type}.toml`,
        `platformatic.${type}.tml`
      ]
    }

    types.push({
      filenames: [
        'platformatic.json',
        'platformatic.json5',
        'platformatic.yaml',
        'platformatic.yml',
        'platformatic.toml',
        'platformatic.tml'
      ]
    })

    const lookup = new Map()
    const filenames = []
    for (const type of types) {
      for (const filename of type.filenames) {
        filenames.push(filename)
        lookup.set(filename, type)
      }
    }

    const configFilesAccessibility = await Promise.all(filenames.map(async (filename) => {
      return {
        filename,
        found: await isFileAccessible(filename, this.#cwd)
      }
    }))

    const found = configFilesAccessibility.find((value, index) => {
      return value.found
    })

    if (!found) {
      const err = new errors.NoConfigFileFoundError()
      err.filenames = filenames
      throw err
    }

    let app

    const matchingType = lookup.get(found.filename)
    if (matchingType.id) {
      // This can be null if we are using generic `platformatic.json` files
      app = await this.get({ $schema: matchingType.id })
    }

    return {
      path: join(this.#cwd, found.filename),
      app
    }
  }

  async loadConfig (opts = {}) {
    const overrides = opts.overrides
    let configFile = opts.config
    let app = opts.app

    if (!configFile) {
      const found = await this.#findConfigFile(opts.directory)
      app ||= found.app
      configFile = found.path
    }

    // TODO we are reading the file twice here, once to find the app, and once to load the config
    // we should probably refactor this to only read the file once
    if (!app) {
      const parser = getParser(configFile)
      const parsed = parser(await readFile(configFile))
      try {
        const meta = await analyze({ config: parsed })
        const config = upgrade(meta).config
        app = await this.get(config, opts)
      } catch (err) {
        app = await this.get(parsed, opts)
      }
    }

    const configManagerConfig = {
      schema: app.schema,
      ...app.configManagerConfig,
      ...overrides
    }

    const envWhitelist = opts.allowEnv ? opts.allowEnv : configManagerConfig.envWhitelist

    const configManager = new ConfigManager({
      source: configFile,
      ...configManagerConfig,
      envWhitelist
    })

    return { configManager, app }
  }
}

module.exports.Store = Store
