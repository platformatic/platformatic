'use strict'

class ZeroSeventeen {
  constructor ({ config, path, format, version }) {
    this.config = config
    this.version = version || '0.17.0'
    this.path = path
    this.format = format || 'json'

    if (config.core) {
      this.kind = 'db'
    } else {
      this.kind = 'service'
    }
  }
}

module.exports = ZeroSeventeen
