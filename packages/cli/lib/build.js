import platformaticBasic from '@platformatic/basic'
import { Store, loadConfig as pltConfigLoadConfig } from '@platformatic/config'
import { buildRuntime, platformaticRuntime } from '@platformatic/runtime'
import { execa, parseCommandString } from 'execa'
import { once } from 'node:events'
import split from 'split2'

async function loadConfig (minimistConfig, args, overrides, replaceEnv = true) {
  const store = new Store()
  store.add(platformaticRuntime)
  store.add(platformaticBasic)

  return pltConfigLoadConfig(minimistConfig, args, store, overrides, replaceEnv)
}

async function buildService (logger, id, cwd, command) {
  const [executable, ...args] = parseCommandString(command)
  const subprocess = execa(executable, args, {
    all: true,
    lines: false,
    stripFinalNewline: false,
    reject: false,
    preferLocal: true,
    cwd
  })

  const exitPromise = once(subprocess, 'exit')

  const output = []
  for await (const line of subprocess.all.pipe(split())) {
    logger.debug(`  ${line}`)
    output.push(line)
  }
  logger.debug('')
  output.push('')

  const [exitCode] = await exitPromise

  if (exitCode !== 0) {
    logger.error(`❌ Building service ${id} (${command}) failed with exit code ${exitCode}: `)

    for (const line of output) {
      logger.error(`  ${line}`)
    }

    process.exit(1)
  }
}

export async function build (args) {
  const config = await loadConfig({}, args)
  config.configManager.args = config.args

  const runtimeConfig = config.configManager
  const runtime = await buildRuntime(runtimeConfig)
  const logger = runtime.logger

  // Gather informations for all services before starting
  const toBuild = new Map()
  const { services } = await runtime.getServices()

  for (const { id } of services) {
    const { path } = runtimeConfig.current.serviceMap.get(id)
    const meta = await runtime.getServiceMeta(id)

    if (meta?.deploy?.buildCommand) {
      toBuild.set(id, [path, meta.deploy.buildCommand])
    }
  }

  // Build all services
  for (const [id, [cwd, command]] of toBuild) {
    logger.info(`Building service "${id}" (${command}) ...`)

    await buildService(logger, id, cwd, command)
  }

  logger.info('✅ All external services have been built.')
  await runtime.close(false, true)
}
