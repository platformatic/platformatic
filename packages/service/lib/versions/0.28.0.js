'use strict'

module.exports.migration = {
  version: '0.28.0',
  toVersion: '1.99.0',
  up: function (config) {
    if (config.watch !== false) {
      config.watch = typeof config.watch === 'object' ? config.watch : true
    }
    delete config.plugins?.watch

    return config
  }
}
