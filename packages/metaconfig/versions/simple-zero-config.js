'use strict'

class SimpleZeroConfig {
  constructor ({ config, path, format, version }) {
    this.config = config
    this.version = version
    this.path = path
    this.format = format || 'json'

    if (config.db) {
      this.kind = 'db'
    } else if (config.composer) {
      this.kind = 'composer'
    } else if (config.entrypoint) {
      this.kind = 'runtime'
    } else {
      this.kind = 'service'
    }
  }
}

module.exports = SimpleZeroConfig
