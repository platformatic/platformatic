'use strict'

const pkg = require('../../package.json')

module.exports = {
  version: '2.0.0',
  up: function (config) {
    config.$schema = `https://schemas.platformatic.dev/@platformatic/service/${pkg.version}.json`
    return config
  }
}
