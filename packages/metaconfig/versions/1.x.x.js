'use strict'

const SimpleZeroConfig = require('./simple-zero-config.js')
const { version } = require('../package.json')
const semver = require('semver')
const rfdc = require('rfdc')()

class OneSeries extends SimpleZeroConfig {
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
    }

    this.up = () => {
      const original = this.config
      const config = rfdc(original)
      const version = semver.inc(this.version, increment)
      config.$schema = `https://platformatic.dev/schemas/v${version}/${this.kind}`

      if (this.kind === 'runtime' && config.watch !== undefined) {
        delete config.watch
      }

      return new OneSeries({ config, path: this.path, format: this.format, version })
    }
  }
}

module.exports = OneSeries
