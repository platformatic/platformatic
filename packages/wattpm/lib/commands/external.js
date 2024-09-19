import { Store } from '@platformatic/config'
import { platformaticRuntime } from '@platformatic/runtime'
import { ensureLoggableError } from '@platformatic/utils'
import { bold } from 'colorette'
import { execa } from 'execa'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, relative, resolve } from 'node:path'
import { checkEmptyDirectory, findConfigurationFile, overrideFatal, parseArgs } from '../utils.js'

async function parseConfiguration (logger, configurationFile) {
  const store = new Store({
    cwd: process.cwd(),
    logger
  })
  store.add(platformaticRuntime)

  const { configManager } = await store.loadConfig({
    config: configurationFile,
    overrides: {
      /* c8 ignore next 3 */
      onMissingEnv (key) {
        return ''
      }
    }
  })

  await configManager.parse()

  return configManager.current
}

export async function importCommand (logger, args) {
  const { values, positionals } = parseArgs(
    args,
    {
      id: {
        type: 'string',
        short: 'i'
      },
      path: {
        type: 'string',
        short: 'p'
      }
    },
    false
  )

  let root
  let rawUrl

  if (positionals.length < 2) {
    rawUrl = positionals[0]
  } else {
    root = positionals[0]
    rawUrl = positionals[1]
  }

  /* c8 ignore next */
  root = resolve(process.cwd(), root ?? '')

  const configurationFile = await findConfigurationFile(logger, root)

  if (!rawUrl) {
    logger.fatal('Please specify the resource to import.')
  }

  const url = rawUrl.match(/^[a-z0-9-_.]+\/[a-z0-9-_.]+$/i) ? `git@github.com:${rawUrl}.git` : rawUrl
  const service = values.id ?? basename(rawUrl, '.git')
  const path = values.path ?? `web/${service}`

  const config = JSON.parse(await readFile(configurationFile))
  /* c8 ignore next */
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

  /* c8 ignore next */
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
      await checkEmptyDirectory(childLogger, service.path, relativePath)

      operation = 'clone repository'

      let url = service.url

      if (url.startsWith('http') && username && password) {
        const parsed = new URL(url)
        parsed.username ||= username
        parsed.password ||= password
        url = parsed.toString()
      }

      if (username) {
        childLogger.info(`Cloning ${bold(service.url)} as user ${bold(username)} into ${bold(relativePath)} ...`)
      } else {
        childLogger.info(`Cloning ${bold(service.url)} into ${bold(relativePath)} ...`)
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

export const help = {
  import: {
    usage: 'import [root] <url>',
    description: 'Imports an external resource as a service',
    args: [
      {
        name: 'root',
        description: 'The directory containing the application (default is the current directory)'
      },
      {
        name: 'url',
        description: 'The URL to import (can be in the form $USER/$REPOSITORY for GitHub repositories)'
      }
    ],
    options: [
      {
        usage: '-i, --id',
        description: 'The id of the service (default is the basename of the URL)'
      },
      {
        usage: '-p, --path',
        description: 'The path where to import the service (default is the service id)'
      }
    ]
  },
  resolve: {
    usage: 'resolve [root]',
    description: 'Resolves all external services',
    args: [
      {
        name: 'root',
        description: 'The directory containing the application (default is the current directory)'
      }
    ],
    options: [
      {
        usage: '-u, --username',
        description: 'The username to use for HTTP URLs'
      },
      {
        usage: '-p, --password',
        description: 'The password to use for HTTP URLs'
      },
      {
        usage: '-s, --skip-dependencies',
        description: 'Do not install services dependencies'
      }
    ],
    footer: `
wattpm resolve command resolves runtime services that have the \`url\` in their configuration.
To change the directory where a service is cloned, you can set the \`path\` property in the service configuration.

After cloning the service, the resolve command will set the relative path to the service in the wattpm configuration file.

Example of the runtime platformatic.json configuration file:

\`\`\`json
{
  "$schema": "https://schemas.platformatic.dev/wattpm/2.0.0.json",
  "entrypoint": "service-1",
  "services": [
    {
      "id": "service-1",
      "path": "./services/service-1",
      "config": "platformatic.json"
    },
    {
      "id": "service-2",
      "config": "platformatic.json",
      "url": "https://github.com/test-owner/test-service.git"
    },
    {
      "id": "service-3",
      "config": "platformatic.json",
      "path": "./custom-external/service-3",
      "url": "https://github.com/test-owner/test-service.git"
    }
  ],
}
\`\`\`

If not specified, the configuration will be loaded from any of the following, in the current directory.

* \`platformatic.json\`, or
* \`platformatic.yml\`, or 
* \`platformatic.tml\`, or 
* \`platformatic.json\`, or
* \`platformatic.yml\`, or 
* \`platformatic.tml\`

You can find more details about the configuration format here:
* [Platformatic DB Configuration](https://docs.platformatic.dev/docs/db/configuration)
* [Platformatic Service Configuration](https://docs.platformatic.dev/docs/service/configuration)
    `
  }
}
