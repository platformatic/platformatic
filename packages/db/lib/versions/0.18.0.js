'use strict'

module.exports = {
  version: '0.18.0',
  up: function (config) {
    config.db = config.core
    return config
  }
}
