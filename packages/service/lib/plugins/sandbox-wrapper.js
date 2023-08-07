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

      if (plugin.encapsulate === false) {
        const skipOverride = loaded[Symbol.for('skip-override')]
        loaded[Symbol.for('skip-override')] = true
        await app.register(loaded, plugin.options)
        loaded[Symbol.for('skip-override')] = skipOverride
      } else {
        await app.register(loaded, plugin.options)
      }
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

  // Expected keys for autoload plugin options that expect regexp patterns
  const patternOptionKeys = ['ignorePattern', 'indexPattern', 'autoHooksPattern']

  for (const key of patternOptionKeys) {
    const pattern = plugin[key]

    // If pattern key not found in plugin object, move on
    if (!pattern) {
      continue
    }

    // Build an instance of a RegExp. If this comes back undefined,
    // then an invalid value was provided. Move on.
    const regExpPattern = stringPatternToRegExp(pattern)
    if (!regExpPattern) {
      continue
    }

    // We have a valid RegExp so add the option to the config to pass along to
    // autoload.
    config[key] = regExpPattern
  }

  return config
}

function stringPatternToRegExp (stringPattern) {
  try {
    return new RegExp(stringPattern)
  } catch (err) {
    return undefined
  }
}
