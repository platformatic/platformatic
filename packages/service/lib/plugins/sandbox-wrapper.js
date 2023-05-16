'use strict'

const fp = require('fastify-plugin')
const autoload = require('@fastify/autoload')
const { stat } = require('fs').promises

module.exports = fp(async function (app, opts) {
  for (let plugin of opts.paths) {
    if (typeof plugin === 'string') {
      plugin = { path: plugin, encapsulate: true }
    }
    if ((await stat(plugin.path)).isDirectory()) {
      app.register(autoload, {
        dir: plugin.path,
        encapsulate: plugin.encapsulate !== false,
        maxDepth: plugin.maxDepth,
        options: plugin.options
      })
    } else {
      let loaded = await import(`file://${plugin.path}`)
      /* c8 ignore next 3 */
      if (loaded.__esModule === true || typeof loaded.default === 'function') {
        loaded = loaded.default
      }

      let skipOverride
      if (plugin.encapsulate === false) {
        skipOverride = loaded[Symbol.for('skip-override')]
        loaded[Symbol.for('skip-override')] = true
      }
      await app.register(loaded, plugin.options)
      loaded[Symbol.for('skip-override')] = skipOverride
    }
  }
})
