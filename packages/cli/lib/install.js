import { join, relative } from 'node:path'
import { access, writeFile, mkdir, readdir } from 'node:fs/promises'
import { Store, getStringifier } from '@platformatic/config'
import { platformaticRuntime } from '@platformatic/runtime'
import parseArgs from 'minimist'
import pino from 'pino'
import pretty from 'pino-pretty'
import { execa } from 'execa'
import fjs from 'fast-json-stringify'

const INSTALLED_SERVICES_DIRNAME = 'external'

export async function install (argv) {
  const args = parseArgs(argv, {
    alias: {
      config: 'c',
    },
    boolean: ['test'],
    default: { test: false },
  })

  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid',
  }))
  try {
    await installServices(args.config, logger, args.test)
  } catch (err) {
    console.log(err)
    process.exit(1)
  }
}

async function installServices (config, logger, isTest = false) {
  const store = new Store({
    cwd: process.cwd(),
    logger,
  })
  store.add(platformaticRuntime)

  const { configManager } = await store.loadConfig({
    config,
    overrides: {
      fixPaths: false,
      onMissingEnv (key) {
        return '{' + key + '}'
      },
    },
  })

  await configManager.parseAndValidate(true)
  config = configManager.current

  // If the schema is present, we use it to format the config
  if (configManager.schema) {
    const stringify = fjs(configManager.schema)
    config = JSON.parse(stringify(config))
  }

  const projectDir = configManager.dirname
  const externalDir = join(projectDir, INSTALLED_SERVICES_DIRNAME)

  if (!config.services || config.services.length === 0) {
    logger.info('No external services to install')
    return
  }

  const services = config.services || []
  for (const service of services) {
    if (service.url) {
      let path = service.path
      if (!path || (path.startsWith('{') && path.endsWith('}'))) {
        await mkdir(externalDir, { recursive: true })
        path = join(externalDir, service.id)
        service.path = relative(projectDir, path)
      } else {
        path = join(projectDir, path)
      }

      const isNotEmpty = await isDirectoryNotEmpty(path)
      if (isNotEmpty) {
        logger.info(`Skipping ${service.id} as it is not empty`)
        continue
      }

      const relativePath = relative(projectDir, path)

      logger.info(`Cloning ${service.url} into ${relativePath}`)
      if (!isTest) {
        await execa('git', ['clone', service.url, path])
      }

      // TODO: replace it with a proper runtime build step
      logger.info(`Installing dependencies for service "${service.id}"`)
      if (!isTest) {
        await execa('npm', ['i'], { cwd: path })
      }

      if (!service.path) {
        service.path = relativePath
      }
    }
  }

  const stringify = getStringifier(configManager.fullPath)
  const newConfig = stringify(config)

  await writeFile(configManager.fullPath, newConfig, 'utf8')

  logger.info('✅ All external services have been installed')
}

async function isDirectoryNotEmpty (directoryPath) {
  try {
    await access(directoryPath)
    const files = await readdir(directoryPath)
    return files.length > 0
  } catch (err) {
    return false
  }
}
