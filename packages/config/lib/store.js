'use strict'

const { createRequire } = require('module')

class Store {
  #map = new Map()
  #require

  constructor (opts) {
    opts = opts || {}
    this.#require = createRequire(opts.cwd || process.cwd())
  }

  add (app) {
    if (typeof app !== 'function') {
      throw new TypeError('app must be a function')
    }

    if (app.schema === undefined) {
      throw new TypeError('schema must be defined')
    }

    if (app.schema.$id === undefined) {
      throw new TypeError('schema.$id must be defined')
    }

    if (typeof app.configType !== 'string') {
      throw new TypeError('configType must be a string')
    }
    // TODO validate configType being unique

    if (app.configManagerConfig === undefined) {
      app.configManagerConfig = {}
    } else {
      app.configManagerConfig.schema = app.schema
    }

    this.#map.set(app.schema.$id, app)
  }

  async get ({ $schema, module }) {
    let app = this.#map.get($schema)

    // try to load module
    if (!app && module) {
      try {
        app = this.#require(module)
      } catch (err) {
        if (err.code === 'ERR_REQUIRE_ESM') {
          const toLoad = this.#require.resolve(module)
          app = (await import(toLoad)).default
        }
      }
    }

    if (app === undefined) {
      throw new Error(`no application found for ${$schema}`)
    }

    return app
  }

  listConfigFiles () {
    return Array.from(this.#map.values()).map((app) => {
      return `platformatic.${app.configType}.json`
    })
  }
}

module.exports.Store = Store
