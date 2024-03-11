'use strict'

module.exports.migration = {
  version: '0.17.0',
  up: function (config) {
    let kind = 'service'
    if (config.core) {
      kind = 'db'
    }

    if (config.core) {
      config.db = config.core
      delete config.core
    }

    config.$schema = `https://platformatic.dev/schemas/v0.17.0/${kind}`
    return config
  }
}
