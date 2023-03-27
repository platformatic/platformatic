'use strict'

class ZeroNineteen {
  constructor ({ config, path, format, version }) {
    this.config = config
    this.version = version || '0.19.0'
    this.path = path
    this.format = format || 'json'

    if (config.db) {
      this.kind = 'db'
    } else {
      this.kind = 'service'
    }
  }
}

module.exports = ZeroNineteen
