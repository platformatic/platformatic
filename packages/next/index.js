import { kMetadata } from '@platformatic/foundation'
import { resolve as resolvePath } from 'node:path'
import { getCacheHandlerPath, NextCapability } from './lib/capability.js'
import { loadConfiguration } from './lib/config.js'
import { NextImageOptimizerCapability } from './lib/image-optimizer.js'

export function getAdapterPath () {
  return resolvePath(import.meta.dirname, 'lib', 'adapter.js')
}

function enhanceNextCacheConfig (nextConfig, modifications) {
  const { config, nextVersion, logger } = globalThis.platformatic

  if (!config.cache?.adapter || config.cache?.enabled === false) return

  const existingCacheHandlers = typeof nextConfig.cacheHandler !== 'undefined' || typeof nextConfig.cacheHandlers?.default !== 'undefined'
  if (existingCacheHandlers) {
    if (!config.cache.ignoreNextConfig) {
      return logger.warn('Next.js cache handlers are already defined in next.config.js. Skipping cache configuration.')
    }
  }

  const cacheComponentsConflict = typeof config.cache?.cacheComponents !== 'undefined' && typeof nextConfig.cacheComponents !== 'undefined' && config.cache?.cacheComponents !== nextConfig.cacheComponents
  if (cacheComponentsConflict) {
    if (!config.cache.ignoreNextConfig) {
      return logger.warn('Platformatic and Next.js Cache Components configs are conflicting. Skipping cache configuration.')
    }
    nextConfig.cacheComponents = config.cache?.cacheComponents
  }

  if (config.cache?.cacheComponents || nextConfig.cacheComponents) {
    if (nextVersion.major <= 15) {
      return logger.warn('Next.js Cache Components are only supported in Next.js 16 and above. Skipping cache configuration.')
    }
    nextConfig.cacheComponents = true
    nextConfig.cacheHandler = getCacheHandlerPath('null-isr')
    nextConfig.cacheHandlers = { default: getCacheHandlerPath(`${config.cache.adapter}-components`) }

    if (config.cache.remote) {
      nextConfig.cacheHandlers.remote = getCacheHandlerPath(`${config.cache.adapter}-components-remote`)
    }

    nextConfig.cacheMaxMemorySize = 0
    modifications.push(['componentsCache', config.cache.adapter])

    if (config.cache.remote) {
      modifications.push(['remoteComponentsCache', config.cache.adapter])
    }
  } else {
    delete nextConfig.cacheHandlers
    nextConfig.cacheHandler = getCacheHandlerPath(`${config.cache.adapter}-isr`)
    nextConfig.cacheMaxMemorySize = 0
    modifications.push(['isrCache', config.cache.adapter])
  }
}

export async function enhanceNextConfig (nextConfig, ...args) {
  // This is to avoid https://github.com/vercel/next.js/issues/76981
  Headers.prototype[Symbol.for('nodejs.util.inspect.custom')] = undefined

  if (typeof nextConfig === 'function') {
    nextConfig = await nextConfig(...args)
  }

  const { basePath, config } = globalThis.platformatic

  if (typeof nextConfig.basePath === 'undefined') {
    nextConfig.basePath = basePath
  }

  const modifications = []

  enhanceNextCacheConfig(nextConfig, modifications)

  if (config.next?.trailingSlash && typeof nextConfig.trailingSlash === 'undefined') {
    nextConfig.trailingSlash = true
    modifications.push(['trailingSlash', 'enabled'])
  }

  if (modifications.length > 0) {
    nextConfig.env ??= {}
    nextConfig.env.PLT_NEXT_MODIFICATIONS = JSON.stringify(Object.fromEntries(modifications))
  }

  globalThis.platformatic.notifyConfig(nextConfig)
  return nextConfig
}

export async function create (configOrRoot, sourceOrConfig, context) {
  const config = await loadConfiguration(configOrRoot, sourceOrConfig, context)

  const Capability = config.next?.imageOptimizer?.enabled ? NextImageOptimizerCapability : NextCapability
  return new Capability(config[kMetadata].root, config, context)
}

export * from './lib/capability.js'
export * from './lib/commands/index.js'
export * from './lib/config.js'
export * as errors from './lib/errors.js'
export * from './lib/image-optimizer.js'
export { packageJson, schema, schemaComponents, version } from './lib/schema.js'
