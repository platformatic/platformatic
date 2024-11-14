import { Store } from '@platformatic/config'
import { platformaticRuntime } from '@platformatic/runtime'
import { execa } from 'execa'
import parseArgs from 'minimist'
import { existsSync } from 'node:fs'
import { join, relative, resolve as resolvePath } from 'node:path'
import pino from 'pino'
import pretty from 'pino-pretty'

export const RESOLVED_SERVICES_DIRNAME = 'external'

export async function resolve (argv) {
  const args = parseArgs(argv, {
    alias: {
      config: 'c',
      username: 'u',
      password: 'p'
    },
    boolean: ['test'],
    string: ['config', 'username', 'password'],
    default: { test: false }
  })

  const logger = pino(
    pretty({
      translateTime: 'SYS:HH:MM:ss',
      ignore: 'hostname,pid'
    })
  )
  try {
    await resolveServices(args.config, logger, {
      test: args.test,
      username: args.username,
      password: args.password
    })
  } catch (err) {
    console.log(err)
    process.exit(1)
  }
}

async function resolveServices (configPath, logger, options = {}) {
  const store = new Store({
    cwd: process.cwd(),
    logger
  })
  store.add(platformaticRuntime)

  const { configManager } = await store.loadConfig({
    config: configPath,
    overrides: {
      onMissingEnv (key) {
        return ''
      }
    }
  })

  configPath = configManager.fullPath
  await configManager.parse(true, [], { validation: true })
  const config = configManager.current
  const root = configManager.dirname

  // The services which might be to be resolved are the one that have a URL and either
  // no path defined (which means no environment variable set) or a non-existing path (which means not resolved yet)
  const resolvableServices = config.services.filter(service => {
    if (!service.url) {
      return false
    }

    if (service.path && existsSync(service.path)) {
      logger.info(`Skipping service ${service.id} as the path already exists`)
      return false
    }

    return true
  })

  // Iterate the services a first time to verify the environment files configuration and which services must be resolved
  const toResolve = []

  // Simply use service.path here
  for (const service of resolvableServices) {
    if (!service.path) {
      service.path = resolvePath(root, `${RESOLVED_SERVICES_DIRNAME}/${service.id}`)
    }

    const directory = resolvePath(root, service.path)

    // If the directory already exists, it's either external or already resolved, nothing to do in both cases
    if (!existsSync(directory)) {
      if (!directory.startsWith(root)) {
        logger.info(
          `Skipping service ${service.id} as the non existent directory ${service.path} is outside the project directory`
        )
      } else {
        // This repository must be resolved
        toResolve.push(service)
      }
    } else {
      logger.info(
        `Skipping service ${service.id} as the generated path ${join(RESOLVED_SERVICES_DIRNAME, service.id)} already exists`
      )
    }
  }

  if (toResolve.length === 0) {
    logger.info('No external services to resolve')
    return
  }

  for (const service of toResolve) {
    if (service.url) {
      const relativePath = relative(root, service.path)

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
        await execa('git', ['clone', url, service.path])
      }

      // TODO: replace it with a proper runtime build step
      logger.info(`Resolving dependencies for service "${service.id}"`)
      if (!options.test) {
        await execa('npm', ['i'], { cwd: service.path })
      }
    }
  }

  logger.info('✅ All external services have been resolved')
}
