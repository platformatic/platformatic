'use strict'

const rfdc = require('rfdc')()

class ZeroSixteen {
  constructor (config) {
    this.config = config
    this.version = '0.16.0'

    if (config.core) {
      this.kind = 'db'
    } else {
      this.kind = 'service'
    }
  }

  up () {
    const original = this.config
    const config = rfdc(original)

    if (original.plugin) {
      if (Array.isArray(original.plugin)) {
        config.plugins = {
          paths: original.plugin.map((p) => {
            if (typeof p === 'string') {
              return p
            } else if (p.options) {
              return {
                path: p.path,
                options: p.options
              }
            } else {
              return p.path
            }
          })
        }

        if (typeof original.plugin[0] === 'object') {
          if ('hotReload' in original.plugin[0]) {
            config.plugins.hotReload = original.plugin[0].hotReload
          }
          if ('stopTimeout' in original.plugin[0]) {
            config.plugins.stopTimeout = original.plugin[0].stopTimeout
          }
          if ('typescript' in original.plugin[0]) {
            config.plugins.typescript = !!original.plugin[0].typescript
          }
        }
      } else if (typeof original.plugin === 'object') {
        if (original.plugin.options) {
          config.plugins = {
            paths: [{
              path: original.plugin.path,
              options: original.plugin.options
            }]
          }
        } else {
          config.plugins = {
            paths: [original.plugin.path]
          }
        }

        if ('hotReload' in original.plugin) {
          config.plugins.hotReload = original.plugin.hotReload
        }

        if ('stopTimeout' in original.plugin) {
          config.plugins.stopTimeout = original.plugin.stopTimeout
        }

        if ('typescript' in  original.plugin) {
          // typescript is a boolean in 0.17.0
          config.plugins.typescript = !!original.plugin.typescript
        }
      } else {
        config.plugins = {
          paths: [original.plugin]
        }
      }

      config.plugin = undefined
    }

    // TODO missing watch mode and other options

    config.$schema = 'https://platformatic.dev/schemas/v0.17.0/' + this.kind

    const ZeroSeventeen = require('./0.17.0.js')

    return new ZeroSeventeen(config)
  }
}

module.exports = ZeroSixteen
