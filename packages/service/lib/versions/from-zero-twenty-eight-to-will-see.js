'use strict'

const { version } = require('../../package.json')

module.exports.migration = {
  version: '0.28.0',
  toVersion: version,
  up: function (config) {
    if (config.watch !== false) {
      config.watch = typeof config.watch === 'object' ? config.watch : true
    }
    delete config.plugins?.watch

    return config
  },
}
