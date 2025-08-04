import { transform as basicTransform, resolve, validationOptions } from '@platformatic/basic'
import { kMetadata, loadConfiguration as utilsLoadConfiguration } from '@platformatic/utils'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { schema } from './lib/schema.js'
import { ServiceStackable } from './lib/stackable.js'
import { upgrade } from './lib/upgrade.js'
import { isDocker } from './lib/utils.js'

export async function transform (config, schema, options) {
  config = await basicTransform(config, schema, options)

  if (config.server && (await isDocker())) {
    config.server.hostname = '0.0.0.0'
  }

  const typescript = config.plugins?.typescript

  if (typescript) {
    let { outDir, tsConfigFile } = typescript
    tsConfigFile ??= 'tsconfig.json'

    if (typeof outDir === 'undefined') {
      try {
        outDir = JSON.parse(await readFile(join(this.dirname, tsConfigFile), 'utf8')).compilerOptions.outDir
      } catch {
        // No-op
      }

      outDir ||= 'dist'
    }

    config.watch.ignore ??= []
    config.watch.ignore.push(outDir + '/**/*')
  }

  return config
}

export async function loadConfiguration (configOrRoot, sourceOrConfig, context) {
  const { root, source } = await resolve(configOrRoot, sourceOrConfig, 'service')

  return utilsLoadConfiguration(source, context?.schema ?? schema, {
    validationOptions,
    transform,
    upgrade,
    replaceEnv: true,
    root,
    ...context
  })
}

export async function create (configOrRoot, sourceOrConfig, context) {
  const config = await loadConfiguration(configOrRoot, sourceOrConfig, context)
  return new ServiceStackable(config[kMetadata].root, config, context)
}

export const skipTelemetryHooks = true

export { platformaticService } from './lib/application.js'
export { applyTestHelperCustomizations, Generator } from './lib/generator.js'
export { packageJson, schema, schemaComponents, version } from './lib/schema.js'
export { ServiceStackable } from './lib/stackable.js'
