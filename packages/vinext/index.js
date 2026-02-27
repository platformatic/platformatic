import { resolve, validationOptions } from '@platformatic/basic'
import { kMetadata, loadConfiguration as utilsLoadConfiguration } from '@platformatic/foundation'
import { transform as nextTransform } from '@platformatic/next'
import { VinextCapability } from './lib/capability.js'
import { schema } from './lib/schema.js'

async function enhanceVinextCacheConfig (nextConfig, modifications) {
  const { config, logger } = globalThis.platformatic

  if (!config.cache?.adapter || config.cache?.enabled === false) return

  const cacheComponentsConflict =
    typeof config.cache?.cacheComponents !== 'undefined' &&
    typeof nextConfig.cacheComponents !== 'undefined' &&
    config.cache?.cacheComponents !== nextConfig.cacheComponents
  if (cacheComponentsConflict) {
    if (!config.cache.ignoreNextConfig) {
      return logger.warn(
        'Platformatic and Vinext Cache Components configs are conflicting. Skipping cache configuration.'
      )
    }
    nextConfig.cacheComponents = config.cache?.cacheComponents
  }

  if (config.cache?.cacheComponents || nextConfig.cacheComponents) {
    nextConfig.cacheComponents = true
    modifications.push(['componentsCache', config.cache.adapter])
  }
}

/* c8 ignore next 5 */
export async function transform (config, schema, options) {
  return nextTransform(config, schema, options)
}

export async function enhanceNextConfig (nextConfig, ...args) {
  // This is to avoid https://github.com/vercel/next/issues/76981
  Headers.prototype[Symbol.for('nodejs.util.inspect.custom')] = undefined

  if (typeof nextConfig === 'function') {
    nextConfig = await nextConfig(...args)
  }

  if (typeof nextConfig.basePath === 'undefined') {
    nextConfig.basePath = globalThis.platformatic.basePath
  }

  const modifications = []

  enhanceVinextCacheConfig(nextConfig, modifications)

  if (modifications.length > 0) {
    nextConfig.env ??= {}
    nextConfig.env.PLT_VINEXT_MODIFICATIONS = JSON.stringify(Object.fromEntries(modifications))
  }

  globalThis.platformatic.notifyConfig(nextConfig)
  return nextConfig
}

export async function loadConfiguration (configOrRoot, sourceOrConfig, context) {
  const { root, source } = await resolve(configOrRoot, sourceOrConfig, 'application')

  return utilsLoadConfiguration(source, context?.schema ?? schema, {
    validationOptions,
    transform,
    replaceEnv: true,
    root,
    ...context
  })
}

export async function create (configOrRoot, sourceOrConfig, context) {
  const config = await loadConfiguration(configOrRoot, sourceOrConfig, context)
  return new VinextCapability(config[kMetadata].root, config, context)
}

export * from './lib/capability.js'
export { packageJson, schema, schemaComponents, version } from './lib/schema.js'
