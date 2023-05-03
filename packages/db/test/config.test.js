'use strict'
const { join } = require('node:path')
const { test } = require('tap')

test('can merge provided config with default config', async ({ plan, same }) => {
  plan(6)
  const { loadConfig } = await import('../lib/load-config.mjs')
  const configFile = join(__dirname, 'fixtures', 'env-whitelist.json')
  const defaultConfig = {
    mergeDefaults: true,
    onMissingEnv (key) {
      if (key === 'HOSTNAME') {
        return 'banana.local'
      } else if (key === 'DATABASE_URL') {
        return 'https://postgres'
      }

      throw new Error(`unexpected key: '${key}'`)
    }
  }

  {
    const config = await loadConfig({}, ['-c', configFile], defaultConfig)
    same(config.configManager.current.server.hostname, 'banana.local')
    same(config.configManager.current.db.connectionString, 'https://postgres')
    // This comes from the default config.
    same(config.configManager.schemaOptions.useDefaults, true)
  }

  {
    defaultConfig.mergeDefaults = false
    const config = await loadConfig({}, ['-c', configFile], defaultConfig)
    same(config.configManager.current.server.hostname, 'banana.local')
    same(config.configManager.current.db.connectionString, 'https://postgres')
    // This comes from the default config.
    same(config.configManager.schemaOptions.useDefaults, undefined)
  }
})
