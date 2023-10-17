'use strict'

const SimpleZeroConfig = require('./simple-zero-config.js')
const { version } = require('../package.json')
const rfdc = require('rfdc')()
const semver = require('semver')
const OneSeries = require('./1.x.x.js')

class FromZeroEighteenToWillSee extends SimpleZeroConfig {
  constructor (opts) {
    super(opts)
    this.config.$schema = `https://platformatic.dev/schemas/v${this.version}/${this.kind}`

    let increment = 'minor'
    if (semver.satisfies(version, '~' + this.version)) {
      if (!semver.eq(version, this.version)) {
        increment = 'patch'
      } else {
        return
      }
    } else if (semver.gt(this.version, version)) {
      return
    } else if (semver.gte(this.version, '0.47.6')) {
      // the latest version is over 1.0.0, change class
      increment = 'major'
    }

    this.up = () => {
      const original = this.config
      const config = rfdc(original)
      const version = semver.inc(this.version, increment)
      config.$schema = `https://platformatic.dev/schemas/v${version}/${this.kind}`

      if (config.watch !== false) {
        config.watch = typeof config.watch === 'object' ? config.watch : {}

        if (config.watch.ignore === undefined) {
          config.watch.ignore = ['*.sqlite', '*.sqlite-journal']
        }
      }

      delete config.plugins?.hotReload
      delete config.db?.dashboard

      if (increment === 'major') {
        return new OneSeries({ config, path: this.path, format: this.format, version })
      } else {
        return new FromZeroEighteenToWillSee({ config, path: this.path, format: this.format, version })
      }
    }
  }
}

module.exports = FromZeroEighteenToWillSee
