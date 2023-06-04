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
      const patternOptions = patternOptionsFromPlugin(plugin)

      app.register(autoload, {
        dir: plugin.path,
        encapsulate: plugin.encapsulate !== false,
        maxDepth: plugin.maxDepth,
        options: plugin.options,
        autoHooks: plugin.autoHooks,
        cascadeHooks: plugin.cascadeHooks,
        overwriteHooks: plugin.overwriteHooks,
        routeParams: plugin.routeParams,
        forceESM: plugin.forceESM,
        ignoreFilter: plugin.ignoreFilter,
        matchFilter: plugin.matchFilter,
        ...patternOptions
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

/**
 * Creates an object for pattern specific options. This ensures that
 * only configurations that have been provided are included in the
 * final result. This prevents 'cannot read properties of undefined'
 * errors when undefined configs are provided to the underlying
 * @fastify/autoload plugin.
 */
function patternOptionsFromPlugin (plugin) {
  const config = {}

  if (plugin.ignorePattern) {
    config.ignorePattern = stringPatternToRegExp(plugin.ignorePattern)
  }

  if (plugin.scriptPattern) {
    config.scriptPattern = stringPatternToRegExp(plugin.scriptPattern)
  }

  if (plugin.indexPattern) {
    config.indexPattern = stringPatternToRegExp(plugin.indexPattern)
  }

  if (plugin.autoHooksPattern) {
    config.autoHooksPattern = stringPatternToRegExp(plugin.autoHooksPattern)
  }

  return config
}

function stringPatternToRegExp (stringPattern) {
  if (!stringPattern || (typeof stringPattern !== 'string')) {
    return undefined
  }
  return new RegExp(stringPattern)
}
