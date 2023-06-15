'use strict'

const SimpleZeroConfig = require('./simple-zero-config.js')
const { version } = require('../package.json')
const rfdc = require('rfdc')()
const semver = require('semver')

class FromZeroEighteenToWillSee extends SimpleZeroConfig {
  constructor (opts) {
    super(opts)
    this.config.$schema = `https://platformatic.dev/schemas/v${this.version}/${this.kind}`

    if (semver.satisfies(version, '~' + this.version) || semver.gt(this.version, version)) {
      return
    }

    this.up = () => {
      const original = this.config
      const config = rfdc(original)
      const version = semver.inc(this.version, 'minor')
      config.$schema = `https://platformatic.dev/schemas/v${version}/${this.kind}`

      if (config.watch !== false) {
        config.watch = typeof config.watch === 'object' ? config.watch : {}

        if (config.watch.ignore === undefined) {
          config.watch.ignore = ['*.sqlite', '*.sqlite-journal']
        }
      }

      return new FromZeroEighteenToWillSee({ config, path: this.path, format: this.format, version })
    }
  }
}

module.exports = FromZeroEighteenToWillSee
