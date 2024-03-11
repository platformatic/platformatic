'use strict'

module.exports.migration = {
  version: '0.18.0',
  toVersion: '0.47.6',
  up: function (config) {
    let kind = 'service'
    if (config.db) {
      kind = 'db'
    } else if (config.composer) {
      kind = 'composer'
    } else if (config.entrypoint) {
      kind = 'runtime'
    }

    config.$schema = `https://platformatic.dev/schemas/v0.18.0/${kind}`

    if (config.watch !== false) {
      config.watch = typeof config.watch === 'object' ? config.watch : {}

      if (config.watch.ignore === undefined) {
        config.watch.ignore = ['*.sqlite', '*.sqlite-journal']
      }
    }

    delete config.plugins?.hotReload
    delete config.db?.dashboard

    return config
  }
}
