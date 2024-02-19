'use strict'

class NoVersion {
  constructor ({ config, path, format }) {
    this.config = config
    this.path = path
    this.format = format || 'json'
    this.version = null
  }
}

module.exports = NoVersion
