import { join, relative } from 'node:path'
import { access, writeFile, mkdir, readdir } from 'node:fs/promises'
import { Store, getStringifier } from '@platformatic/config'
import { platformaticRuntime } from '@platformatic/runtime'
import parseArgs from 'minimist'
import pino from 'pino'
import pretty from 'pino-pretty'
import { execa } from 'execa'
import fjs from 'fast-json-stringify'

const DOWNLOAD_SERVICES_DIRNAME = 'external'

export async function download (argv) {
  const args = parseArgs(argv, {
    alias: {
      config: 'c',
      username: 'u',
      password: 'p',
    },
    boolean: ['test'],
    string: ['config', 'username', 'password'],
    default: { test: false },
  })

  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid',
  }))
  try {
    await downloadServices(args.config, logger, {
      test: args.test,
      username: args.username,
      password: args.password,
    })
  } catch (err) {
    console.log(err)
    process.exit(1)
  }
}

async function downloadServices (config, logger, options = {}) {
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
  const externalDir = join(projectDir, DOWNLOAD_SERVICES_DIRNAME)

  if (!config.services || config.services.length === 0) {
    logger.info('No external services to download')
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
      if (!options.test) {
        let url = service.url
        if (options.username && options.password) {
          const urlObj = new URL(service.url)
          if (!urlObj.username && !urlObj.password) {
            urlObj.username = options.username
            urlObj.password = options.password
          }
          url = urlObj.href
        }
        await execa('git', ['clone', url, path])
      }

      // TODO: replace it with a proper runtime build step
      logger.info(`Downloading dependencies for service "${service.id}"`)
      if (!options.test) {
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

  logger.info('✅ All external services have been downloaded')
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
