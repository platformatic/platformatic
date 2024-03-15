'use strict'

module.exports.migration = {
  version: '0.28.0',
  up: function (config) {
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
