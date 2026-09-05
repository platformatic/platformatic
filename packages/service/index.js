import { loadCapabilityConfiguration, transform as basicTransform, validationOptions } from '@platformatic/basic'
import { kMetadata } from '@platformatic/foundation'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ServiceCapability } from './lib/capability.js'
import { schema } from './lib/schema.js'
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
  return loadCapabilityConfiguration(configOrRoot, sourceOrConfig, context, {
    schema,
    scope: import.meta.filename,
    suffixes: 'service',
    validationOptions,
    transform,
    upgrade
  })
}

export async function create (configOrRoot, sourceOrConfig, context) {
  const config = await loadConfiguration(configOrRoot, sourceOrConfig, context)
  return new ServiceCapability(config[kMetadata].root, config, context)
}

export { platformaticService } from './lib/application.js'
export { ServiceCapability } from './lib/capability.js'
export { applyTestHelperCustomizations, Generator } from './lib/generator.js'
export { packageJson, schema, schemaComponents, skipTracingHooks, version } from './lib/schema.js'

export * from './lib/factory.js'
