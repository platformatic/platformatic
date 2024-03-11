'use strict'

const { version } = require('../../package.json')

module.exports.migration = {
  version: '1.0.0',
  toVersion: version,
  up: function (config) {
    let kind = 'service'
    if (config.db) {
      kind = 'db'
    } else if (config.composer) {
      kind = 'composer'
    } else if (config.entrypoint) {
      kind = 'runtime'
    }

    if (kind === 'runtime' && config.watch !== undefined) {
      delete config.watch
    }

    config.$schema = `https://platformatic.dev/schemas/v${version}/${kind}`
    return config
  }
}
