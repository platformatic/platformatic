import { join, relative, resolve as resolvePath } from 'node:path'
import { access, writeFile, readFile, mkdir, readdir } from 'node:fs/promises'
import { Store, getParser, getStringifier } from '@platformatic/config'
import { platformaticRuntime } from '@platformatic/runtime'
import parseArgs from 'minimist'
import pino from 'pino'
import pretty from 'pino-pretty'
import { execa } from 'execa'

const RESOLVED_SERVICES_DIRNAME = 'external'

export async function resolve (argv) {
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
    await resolveServices(args.config, logger, {
      test: args.test,
      username: args.username,
      password: args.password,
    })
  } catch (err) {
    console.log(err)
    process.exit(1)
  }
}

async function resolveServices (configPath, logger, options = {}) {
  const store = new Store({
    cwd: process.cwd(),
    logger,
  })
  store.add(platformaticRuntime)

  const { configManager } = await store.loadConfig({
    config: configPath,
    overrides: {
      onMissingEnv (key) {
        return '{' + key + '}'
      },
    },
  })

  configPath = configManager.fullPath

  const parseConfig = getParser(configPath)
  const configFile = await readFile(configPath, 'utf8')
  const config = await parseConfig(configFile)

  if (!config.services || config.services.length === 0) {
    logger.info('No external services to resolve')
    return
  }

  const projectDir = configManager.dirname
  const externalDir = join(projectDir, RESOLVED_SERVICES_DIRNAME)

  const services = config.services || []
  for (const service of services) {
    if (service.url) {
      let path = service.path
      if (path && path.startsWith('{') && path.endsWith('}')) {
        path = await configManager.replaceEnv(path)

        // Failed to resolve the path
        if (path.startsWith('{') && path.endsWith('}')) {
          path = null
        }
      }

      if (!path) {
        await mkdir(externalDir, { recursive: true })
        path = join(externalDir, service.id)
        service.path = relative(projectDir, path)
      } else {
        path = resolvePath(projectDir, path)
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
      logger.info(`Resolving dependencies for service "${service.id}"`)
      if (!options.test) {
        await execa('npm', ['i'], { cwd: path })
      }

      if (!service.path) {
        service.path = relativePath
      }
    }
  }

  const stringifyConfig = getStringifier(configPath)
  const newConfig = stringifyConfig(config)

  await writeFile(configManager.fullPath, newConfig, 'utf8')

  logger.info('✅ All external services have been resolved')
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
