'use strict'

const { isFileAccessible, splitModuleFromVersion } = require('./utils')
const { join } = require('node:path')
const { loadModule } = require('@platformatic/utils')
const { ConfigManager } = require('./manager')
const { readFile } = require('node:fs/promises')
const { readFileSync } = require('node:fs')
const { createRequire } = require('node:module')
const { getParser } = require('./formats')
const errors = require('./errors')
const { abstractLogger } = require('@platformatic/utils')

const pltVersion = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8')).version

// Important: do not put $ in any RegExp since we might use the querystring to deliver additional information
const knownSchemas = [
  [/^https:\/\/platformatic.dev\/schemas\/(.*)\/(.*)/, match => match[2]],
  [/^https:\/\/schemas.platformatic.dev\/@platformatic\/(.*)\/(.*)\.json/, match => match[1]],
  /* c8 ignore next */
  [/^https:\/\/schemas.platformatic.dev\/wattpm\/(.*)\.json/, () => 'runtime']
]

// Keys are default types, values are the suffix for the default configuration file
const defaultTypesWithAliases = {
  service: 'service',
  db: 'db',
  composer: 'composer',
  basic: 'application',
  node: 'application',
  vite: 'application',
  nest: 'application',
  next: 'application',
  astro: 'application',
  remix: 'application'
}

function matchKnownSchema (url) {
  if (!url) {
    return
  }

  for (const [pattern, extract] of knownSchemas) {
    const match = url.match(pattern)

    if (match) {
      return extract(match)
    }
  }
}

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
    this.logger = opts.logger || abstractLogger
  }

  add (app) {
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

    app.configManagerConfig ??= {}
    this.#map.set(app.schema.$id, app)
  }

  async _get ({ $schema, module, extends: _extends, core, db }, { directory } = {}) {
    // We support both 'module' and 'extends'. Note that we have to rename the veriable, because "extends" is a reserved word
    const { module: extendedModule, version } = splitModuleFromVersion(_extends || module)
    let app = this.#map.get($schema)

    let type = matchKnownSchema($schema)
    const require = this.#createRequire(type, directory)

    // Legacy Platformatic apps
    if (!app && !type && $schema?.indexOf('./') === 0 && !extendedModule) {
      if (core || db) {
        type = 'db'
      } else {
        type = 'service'
      }
    }

    if (!app && type) {
      let toLoad = `https://platformatic.dev/schemas/v${pltVersion}/${type}`
      app = this.#map.get(toLoad)

      if (!app) {
        toLoad = `https://schemas.platformatic.dev/@platformatic/${type}/${pltVersion}.json`
        app = this.#map.get(toLoad)
      }

      if (!app && defaultTypesWithAliases[type]) {
        app = await loadModule(require, `@platformatic/${type}`)
        this.add(app)
      }
    }

    // try to load module
    if (!app && extendedModule) {
      app = await loadModule(require, extendedModule)
    }

    if (!app) {
      throw new errors.AddAModulePropertyToTheConfigOrAddAKnownSchemaError()
    }

    return { app, version }
  }

  async get (...args) {
    const { app } = await this._get(...args)
    return app
  }

  // TODO(mcollina): remove in the next major version
  /* c8 ignore next 10 */
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

    const typeSet = new Set()

    for (const _ of types) {
      const type = _.configType
      typeSet.add(type)
      _.filenames = [
        `platformatic.${type}.json`,
        `platformatic.${type}.json5`,
        `platformatic.${type}.yaml`,
        `platformatic.${type}.yml`,
        `platformatic.${type}.toml`,
        `platformatic.${type}.tml`
      ]
    }

    for (const [type, alias] of Object.entries(defaultTypesWithAliases)) {
      if (typeSet.has(type)) {
        continue
      }

      const _ = {
        configType: type,
        filenames: [
          `platformatic.${alias}.json`,
          `platformatic.${alias}.json5`,
          `platformatic.${alias}.yaml`,
          `platformatic.${alias}.yml`,
          `platformatic.${alias}.toml`,
          `platformatic.${alias}.tml`
        ]
      }

      types.push(_)
    }

    types.push({
      filenames: [
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
      ]
    })

    const lookup = new Map()
    const uniqueFilenames = new Set()
    for (const type of types) {
      for (const filename of type.filenames) {
        uniqueFilenames.add(filename)
        lookup.set(filename, type)
      }
    }

    const filenames = Array.from(uniqueFilenames)

    const configFilesAccessibility = await Promise.all(
      filenames.map(async filename => {
        return {
          filename,
          found: await isFileAccessible(filename, this.#cwd)
        }
      })
    )

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
    let version

    if (!configFile) {
      const found = await this.#findConfigFile(opts.directory)
      app ||= found.app
      configFile = found.path
    }

    // TODO we are reading the file twice here, once to find the app, and once to load the config
    // we should probably refactor this to only read the file once
    if (!app) {
      const parser = getParser(configFile)
      let parsed

      try {
        parsed = parser(await readFile(configFile, 'utf-8'))
      } catch (err) {
        const newerr = new errors.CannotParseConfigFileError(err.message)
        newerr.cause = err
        throw newerr
      }

      const res = await this._get(parsed, opts)
      app = res.app
      version = res.version
    }

    const configManagerConfig = {
      schema: app.schema,
      configVersion: version,
      logger: this.logger,
      ...app.configManagerConfig,
      ...overrides
    }

    const configManager = new ConfigManager({
      source: configFile,
      ...configManagerConfig
    })

    return { configManager, app }
  }

  async loadEmptyConfig ({ app, directory, overrides }) {
    const version = app.version

    const configManager = new ConfigManager({
      source: {},
      schema: {},
      dirname: directory,
      configVersion: version,
      logger: this.logger,
      ...app.configManagerConfig,
      ...overrides
    })

    return { configManager, app }
  }

  #createRequire (type, directory) {
    if (directory) {
      return createRequire(join(directory, 'noop.js'))
    }

    return this.#require
  }
}

module.exports.Store = Store
module.exports.matchKnownSchema = matchKnownSchema
