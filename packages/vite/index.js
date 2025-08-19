import { transform as basicTransform, resolve, validationOptions } from '@platformatic/basic'
import { kMetadata, loadConfiguration as utilsLoadConfiguration } from '@platformatic/foundation'
import { ViteCapability, ViteSSRCapability } from './lib/capability.js'
import { schema } from './lib/schema.js'

/* c8 ignore next 5 */
export async function transform (config, schema, options) {
  config = await basicTransform(config, schema, options)

  config.watch = { enabled: false }

  if (config.vite.ssr === true) {
    config.vite.ssr = {
      enabled: true,
      entrypoint: 'server.js',
      clientDirectory: 'client',
      serverDirectory: 'server'
    }
  }

  return config
}

export function normalizeOn404 (on404, code = 200, type = 'text/html', path = 'index.html') {
  if (!on404) {
    return { enabled: false, code, type, path }
  }
  if (on404 === true) {
    return { enabled: true, code, type, path }
  }
  if (typeof on404 === 'string') {
    return { enabled: !!on404, code, type, path: on404 ?? path }
  }
  if (typeof on404 === 'object') {
    return {
      enabled: on404.enabled ?? !!on404.path,
      code: on404.code ?? code,
      type: on404.type ?? type,
      path: on404.path ?? path,
    }
  }
  // schema says unreachable, but let's be safe
  return { enabled: false, code, type, path }
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

  // When in SSR mode, we use ViteSSRCapability, which is a subclass of @platformatic/node
  const Capability = config.vite?.ssr?.enabled ? ViteSSRCapability : ViteCapability
  return new Capability(config[kMetadata].root, config, context)
}

export * from './lib/capability.js'
export { packageJson, schema, schemaComponents, version } from './lib/schema.js'
