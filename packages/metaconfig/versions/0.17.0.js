'use strict'

class ZeroSeventeen {
  constructor (config) {
    this.config = config
    this.version = '0.17.0'

    if (config.core) {
      this.kind = 'db'
    } else {
      this.kind = 'service'
    }
  }
}

module.exports = ZeroSeventeen
