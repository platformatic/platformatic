import { transform as basicTransform, resolve, validationOptions } from '@platformatic/basic'
import { loadConfiguration } from '@platformatic/utils'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { schema } from './lib/schema.js'
import { ServiceStackable } from './lib/stackable.js'
import { upgrade } from './lib/upgrade.js'
import { isDocker } from './lib/utils.js'

export async function transform (config) {
  config = await basicTransform(config)

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

export async function create (configFileOrRoot, sourceOrConfig, context) {
  const { root, source } = await resolve(configFileOrRoot, sourceOrConfig, 'service')

  const config = await loadConfiguration(source, context?.schema ?? schema, {
    validationOptions: context?.validationOptions ?? validationOptions,
    transform: context?.transform ?? transform,
    upgrade: context?.upgrade ?? upgrade,
    replaceEnv: true,
    onMissingEnv: context?.onMissingEnv,
    root
  })

  return new ServiceStackable(root, config, context)
}

export const skipTelemetryHooks = true

export { platformaticService } from './lib/application.js'
export { Generator } from './lib/generator.js'
export { packageJson, schema, schemaComponents, version } from './lib/schema.js'
export { ServiceStackable } from './lib/stackable.js'
