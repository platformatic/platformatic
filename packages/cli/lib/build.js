import platformaticBasic from '@platformatic/basic'
import { Store, loadConfig as pltConfigLoadConfig } from '@platformatic/config'
import { buildRuntime, platformaticRuntime } from '@platformatic/runtime'

async function loadConfig (minimistConfig, args, overrides, replaceEnv = true) {
  const store = new Store()
  store.add(platformaticRuntime)
  store.add(platformaticBasic)

  return pltConfigLoadConfig(minimistConfig, args, store, overrides, replaceEnv)
}

export async function build (args) {
  const config = await loadConfig({}, args)
  config.configManager.args = config.args

  const runtimeConfig = config.configManager
  const runtime = await buildRuntime(runtimeConfig)
  const logger = runtime.logger

  // Gather informations for all services before starting
  const { services } = await runtime.getServices()

  for (const { id } of services) {
    logger.info(`Building service "${id}" ...`)
    await runtime.buildService(id)
  }

  logger.info('✅ All services have been built.')
  await runtime.close(false, true)
}
