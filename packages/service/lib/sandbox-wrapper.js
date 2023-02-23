'use strict'

const fp = require('fastify-plugin')
const autoload = require('@fastify/autoload')
const { stat } = require('fs').promises

module.exports = fp(async function (app, opts) {
  for (let plugin of opts.paths) {
    if (typeof plugin === 'string') {
      plugin = { path: plugin }
    }
    if ((await stat(plugin.path)).isDirectory()) {
      app.register(autoload, {
        dir: plugin.path,
        options: plugin.options
      })
    } else {
      let loaded = await import(`file://${plugin.path}`)
      /* c8 ignore next 3 */
      if (loaded.__esModule === true) {
        loaded = loaded.default
      }
      await app.register(loaded, plugin.options)
    }
  }
})
