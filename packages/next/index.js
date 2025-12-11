import { transform as basicTransform, resolve, validationOptions } from '@platformatic/basic'
import { kMetadata, loadConfiguration as utilsLoadConfiguration } from '@platformatic/foundation'
import { getCacheHandlerPath, NextCapability } from './lib/capability.js'
import { schema } from './lib/schema.js'

/* c8 ignore next 9 */
export async function transform (config, schema, options) {
  config = await basicTransform(config, schema, options)
  config.watch = { enabled: false }

  if (config.cache?.adapter === 'redis') {
    config.cache.adapter = 'valkey'
  }

  return config
}

export async function enhanceNextConfig (nextConfig, ...args) {
  // This is to avoid https://github.com/vercel/next.js/issues/76981
  Headers.prototype[Symbol.for('nodejs.util.inspect.custom')] = undefined

  if (typeof nextConfig === 'function') {
    nextConfig = await nextConfig(...args)
  }

  const { basePath, config, nextVersion } = globalThis.platformatic

  if (typeof nextConfig.basePath === 'undefined') {
    nextConfig.basePath = basePath
  }

  const modifications = []

  if (config.cache?.adapter) {
    if (nextVersion.major > 15 && config.cache?.cacheComponents && typeof nextConfig.cacheComponents === 'undefined') {
      nextConfig.cacheComponents = true
      nextConfig.cacheHandler = getCacheHandlerPath('null-isr')
      nextConfig.cacheHandlers = { default: getCacheHandlerPath(`${config.cache.adapter}-components`) }
      nextConfig.cacheMaxMemorySize = 0
      modifications.push(['componentsCache', config.cache.adapter])
    } else if (typeof nextConfig.cacheHandler === 'undefined') {
      nextConfig.cacheHandler = getCacheHandlerPath(`${config.cache.adapter}-isr`)
      nextConfig.cacheMaxMemorySize = 0
      modifications.push(['isrCache', config.cache.adapter])
    }
  }

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
  return new NextCapability(config[kMetadata].root, config, context)
}

export * as cachingValkey from './lib/caching/valkey-isr.js'
export * from './lib/capability.js'
export * as errors from './lib/errors.js'
export { packageJson, schema, schemaComponents, version } from './lib/schema.js'
