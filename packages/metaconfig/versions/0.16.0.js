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
            } else {
              return p.path
            }
          })
        }
      } else if (typeof original.plugin === 'object') {
        // add more cases here
        config.plugins = {
          paths: [original.plugin.path]
        }
      } else {
        config.plugins = {
          paths: [original.plugin]
        }
      }

      config.plugin = undefined
      if (original.plugin.typescript) {
        config.plugins.typescript = true
      }
    }

    // TODO missing watch mode and other options

    config.$schema = 'https://platformatic.dev/schemas/v0.17.0/' + this.kind

    const ZeroSeventeen = require('./0.17.0.js')

    return new ZeroSeventeen(config)
  }
}

module.exports = ZeroSixteen
