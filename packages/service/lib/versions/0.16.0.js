'use strict'

module.exports = {
  version: '0.16.0',
  toVersion: '0.17.0',
  up: function (config) {
    let kind = 'service'
    // This file will be reused in platformatic/db
    if (config.core) {
      kind = 'db'
    }

    if (config.plugin) {
      if (Array.isArray(config.plugin)) {
        config.plugins = {
          paths: config.plugin.map((p) => {
            if (typeof p === 'string') {
              return p
            } else if (p.options) {
              return {
                path: p.path,
                options: p.options,
              }
            } else {
              return p.path
            }
          }),
        }

        if (typeof config.plugin[0] === 'object') {
          if ('hotReload' in config.plugin[0]) {
            config.plugins.hotReload = config.plugin[0].hotReload
          }
          if ('stopTimeout' in config.plugin[0]) {
            config.plugins.stopTimeout = config.plugin[0].stopTimeout
          }
          if ('typescript' in config.plugin[0]) {
            config.plugins.typescript = !!config.plugin[0].typescript
          }
        }
      } else if (typeof config.plugin === 'object') {
        if (config.plugin.options) {
          config.plugins = {
            paths: [{
              path: config.plugin.path,
              options: config.plugin.options,
            }],
          }
        } else {
          config.plugins = {
            paths: [config.plugin.path],
          }
        }

        if ('hotReload' in config.plugin) {
          config.plugins.hotReload = config.plugin.hotReload
        }

        if ('stopTimeout' in config.plugin) {
          config.plugins.stopTimeout = config.plugin.stopTimeout
        }

        if ('typescript' in config.plugin) {
          // typescript is a boolean in 0.17.0
          config.plugins.typescript = !!config.plugin.typescript
        }
      } else {
        config.plugins = {
          paths: [config.plugin],
        }
      }

      delete config.plugin
    }

    // TODO missing watch mode and other options

    config.$schema = 'https://platformatic.dev/schemas/v0.17.0/' + kind

    return config
  },
}
