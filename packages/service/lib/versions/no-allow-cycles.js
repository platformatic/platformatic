'use strict'

const { version } = require('../../package.json')

module.exports.migration = {
  version: '1.99.0', // This is to account alpha versions as well
  toVersion: version,
  up: function (config) {
    if (typeof config.allowCycles === 'boolean') {
      delete config.allowCycles
    }

    return config
  },
}
