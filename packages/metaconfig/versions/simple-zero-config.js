'use strict'

class SimpleZeroConfig {
  constructor ({ config, path, format, version }) {
    this.config = config
    this.version = version
    this.path = path
    this.format = format || 'json'

    if (config.db) {
      this.kind = 'db'
    } else {
      this.kind = 'service'
    }
  }
}

module.exports = SimpleZeroConfig
