import platformaticBasic from '@platformatic/basic'
import { Store, loadConfig as pltConfigLoadConfig } from '@platformatic/config'
import { buildRuntime, platformaticRuntime } from '@platformatic/runtime'
import { errors } from '@platformatic/utils'

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

    try {
      await runtime.buildService(id)
    } catch (error) {
      if (error.code === 'PLT_BASIC_NON_ZERO_EXIT_CODE') {
        logger.error(`Building service "${id}" has failed with exit code ${error.exitCode}.`)
      } else {
        logger.error({ err: errors.ensureLoggableError(error) }, `Building service "${id}" has throw an exception.`)
      }

      process.exit(1)
    }
  }

  logger.info('✅ All services have been built.')
  await runtime.close(false, true)
}
