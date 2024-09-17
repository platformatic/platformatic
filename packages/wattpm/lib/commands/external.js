import { Store } from '@platformatic/config'
import { platformaticRuntime } from '@platformatic/runtime'
import { ensureLoggableError } from '@platformatic/utils'
import { bold } from 'colorette'
import { execa } from 'execa'
import { existsSync } from 'node:fs'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, relative, resolve } from 'node:path'
import { findConfigurationFile, overrideFatal, parseArgs } from '../utils.js'

async function parseConfiguration (logger, configurationFile) {
  const store = new Store({
    cwd: process.cwd(),
    logger
  })
  store.add(platformaticRuntime)

  const { configManager } = await store.loadConfig({
    config: configurationFile,
    overrides: {
      onMissingEnv (key) {
        return ''
      }
    }
  })

  await configManager.parse()

  return configManager.current
}

export async function importCommand (logger, args) {
  const {
    values: { directory: root },
    positionals
  } = parseArgs(
    args,
    {
      directory: {
        type: 'string',
        short: 'd',
        default: process.cwd()
      }
    },
    false
  )

  const configurationFile = await findConfigurationFile(logger, root)
  const rawUrl = positionals[0]

  if (!rawUrl) {
    logger.fatal('Please specify the resource to import.')
  }

  const url = rawUrl.match(/^[a-z0-9-_.]+\/[a-z0-9-_.]+$/i) ? `git@github.com:${rawUrl}.git` : rawUrl
  const service = positionals[1] ?? basename(url, '.git')
  const path = positionals[2] ?? service

  const config = JSON.parse(await readFile(configurationFile))
  config.web ??= []
  config.web.push({ id: service, path, url })

  await writeFile(configurationFile, JSON.stringify(config, null, 2), 'utf-8')
}

export async function resolveCommand (logger, args) {
  const {
    values: { username, password, 'skip-dependencies': skipDependencies },
    positionals
  } = parseArgs(
    args,
    {
      username: {
        type: 'string',
        short: 'u',
        default: process.env.WATTPM_RESOLVE_USERNAME
      },
      password: {
        type: 'string',
        short: 'p',
        default: process.env.WATTPM_RESOLVE_PASSWORD
      },
      'skip-dependencies': {
        type: 'boolean',
        short: 's',
        default: false
      }
    },
    false
  )
  const root = resolve(process.cwd(), positionals[0] ?? '')

  const configurationFile = await findConfigurationFile(logger, root)
  const config = await parseConfiguration(logger, configurationFile)

  for (const service of config.services) {
    let operation
    const childLogger = logger.child({ name: service.id })
    overrideFatal(childLogger)

    try {
      if (!service.url) {
        continue
      }

      childLogger.info(`Resolving service ${bold(service.id)} ...`)

      const relativePath = relative(root, service.path)

      // Check that the target directory is empty, otherwise cloning will likely fail
      if (existsSync(service.path)) {
        const statObject = await stat(service.path)

        if (!statObject.isDirectory()) {
          childLogger.fatal(`Path ${bold(relativePath)} exists but it is not a directory.`)
        }

        const entries = await readdir(service.path)

        if (entries.length) {
          childLogger.fatal(`Directory ${bold(relativePath)} is not empty.`)
        }
      }

      operation = 'clone repository'
      childLogger.info(`Cloning ${bold(service.url)} into ${bold(relativePath)} ...`)

      let url = service.url

      if (url.startsWith('http') && username && password) {
        const parsed = new URL(url)
        parsed.username ||= username
        parsed.password ||= password
        url = parsed.toString()
      }

      await execa('git', ['clone', url, service.path])

      if (!skipDependencies) {
        operation = 'installing dependencies'
        childLogger.info('Installing dependencies ...')
        await execa('npm', ['i'], { cwd: service.path })
      }
    } catch (error) {
      childLogger.fatal({ error: ensureLoggableError(error) }, `Unable to ${operation} of service ${bold(service.id)}`)
    }
  }

  logger.done('All services have been resolved.')
}
