import { deepStrictEqual, strictEqual } from 'node:assert'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { createTemporaryDirectory } from '../../basic/test/helper.js'
import { hasViteConfigFile, loadConfiguration, NitroCapability, resolveNitroPackage } from '../index.js'
import { schema } from '../lib/schema.js'

test('detects all supported Vite config names and configured custom files', async t => {
  for (const name of ['vite.config.js', 'vite.config.mjs', 'vite.config.cjs', 'vite.config.ts', 'vite.config.mts', 'vite.config.cts']) {
    const root = await createTemporaryDirectory(t, 'nitro-detection')
    await mkdir(root, { recursive: true })
    await writeFile(resolve(root, name), '')
    strictEqual(hasViteConfigFile(root), true)
  }

  const root = await createTemporaryDirectory(t, 'nitro-custom-detection')
  await mkdir(root, { recursive: true })
  await writeFile(resolve(root, 'custom.vite.js'), '')
  strictEqual(hasViteConfigFile(root, { vite: { configFile: 'custom.vite.js' } }), true)
  strictEqual(hasViteConfigFile(root, { vite: { configFile: 'missing.js' } }), false)

  await writeFile(resolve(root, 'vite.config.js'), '')
  strictEqual(hasViteConfigFile(root, { vite: { configFile: false } }), false)
})

test('resolves the declared Nitro package', async () => {
  const nitro = await resolveNitroPackage(resolve(import.meta.dirname, '..'))

  strictEqual(nitro.name, 'nitro')
  strictEqual(typeof nitro.root, 'string')
  strictEqual(typeof nitro.packageJson.version, 'string')
})

test('uses Nitro output defaults in application packaging', async t => {
  const root = await createTemporaryDirectory(t, 'nitro-output-defaults')

  const defaults = await loadConfiguration(root, {})
  deepStrictEqual(defaults.application.include, ['.output'])

  const nitroOutput = await loadConfiguration(root, { nitro: { outputDirectory: 'nitro-output' } })
  deepStrictEqual(nitroOutput.application.include, ['nitro-output'])

  const applicationOutput = await loadConfiguration(root, { application: { outputDirectory: 'application-output' } })
  deepStrictEqual(applicationOutput.application.include, ['application-output'])

  const emptyInclude = await loadConfiguration(root, { application: { include: [] } })
  deepStrictEqual(emptyInclude.application.include, [])

  const customInclude = await loadConfiguration(root, { application: { include: ['custom'] } })
  deepStrictEqual(customInclude.application.include, ['custom'])

  strictEqual(schema.properties.application.properties.include.default, undefined)
  strictEqual(schema.properties.application.properties.outputDirectory.default, '.output')
  strictEqual(schema.properties.nitro.properties.entrypoint.default, 'server/index.mjs')
})

test('sets and restores NITRO_APP_BASE_URL around standalone builds', async t => {
  const root = await createTemporaryDirectory(t, 'nitro-build-base-path')
  const config = await loadConfiguration(root, {
    application: {
      basePath: '/application',
      commands: { build: 'custom build' }
    }
  })
  const capability = new NitroCapability(root, config, { isProduction: true })
  const originalValue = process.env.NITRO_APP_BASE_URL
  process.env.NITRO_APP_BASE_URL = '/parent'

  t.after(() => {
    if (originalValue === undefined) {
      delete process.env.NITRO_APP_BASE_URL
    } else {
      process.env.NITRO_APP_BASE_URL = originalValue
    }
  })

  capability.buildWithCommand = async command => {
    strictEqual(command, 'custom build')
    strictEqual(process.env.NITRO_APP_BASE_URL, '/application')
  }

  await capability.build()
  strictEqual(process.env.NITRO_APP_BASE_URL, '/parent')
})
