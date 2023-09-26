'use strict'

const SimpleZeroConfig = require('./simple-zero-config.js')

class OneSeries extends SimpleZeroConfig {
  constructor (opts) {
    super(opts)
    this.config.$schema = `https://platformatic.dev/schemas/v${this.version}/${this.kind}`
  }
}

module.exports = OneSeries
