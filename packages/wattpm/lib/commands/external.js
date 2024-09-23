import { configCandidates } from '@platformatic/basic'
import { Store } from '@platformatic/config'
import { platformaticRuntime } from '@platformatic/runtime'
import { ensureLoggableError } from '@platformatic/utils'
import { bold } from 'colorette'
import { execa } from 'execa'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, relative, resolve, sep } from 'node:path'
import { defaultServiceJson } from '../defaults.js'
import { version } from '../schema.js'
import { checkEmptyDirectory, findConfigurationFile, overrideFatal, parseArgs } from '../utils.js'

const originCandidates = ['origin', 'upstream']

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

async function parseLocalFolder (path) {
  // Read the package.json, if any
  const packageJsonPath = resolve(path, 'package.json')
  let packageJson
  try {
    packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'))
  } catch {
    packageJson = {}
  }

  let url

  // Detect if there is a git folder and eventually get the remote
  for (const candidate of originCandidates) {
    try {
      const result = await execa('git', ['remote', 'get-url', candidate], { cwd: path })
      url = result.stdout.trim()
      break
    } catch (e) {
      // No-op
    }
  }

  return { id: packageJson.name ?? basename(path), url, packageJson }
}

async function findExistingConfiguration (root, path) {
  for (const candidate of configCandidates) {
    const candidatePath = resolve(root, path, candidate)

    if (existsSync(candidatePath)) {
      return candidate
    }
  }
}

async function addService (configurationFile, id, path, url) {
  const config = JSON.parse(await readFile(configurationFile, 'utf-8'))
  /* c8 ignore next */
  config.web ??= []
  config.web.push({ id, path, url })

  await writeFile(configurationFile, JSON.stringify(config, null, 2), 'utf-8')
}

async function importLocal (logger, root, configurationFile, path) {
  const { id, url, packageJson } = await parseLocalFolder(path)

  // Modify the configuration
  const config = JSON.parse(await readFile(configurationFile, 'utf-8'))
  let isAutoloaded = false
  const autoLoadPath = config.autoload?.path
  if (autoLoadPath) {
    const relativePath = relative(root, path)

    isAutoloaded = relativePath.startsWith(`${autoLoadPath}${sep}`)
  }

  if (!isAutoloaded) {
    await addService(configurationFile, id, path, url)
  }

  // Check if there is any configuration file we recognize. If so, don't do anything
  const wattConfiguration = await findExistingConfiguration(root, path)
  if (wattConfiguration) {
    /* c8 ignore next */
    const displayPath = isAbsolute(path) ? path : relative(root, path)

    logger.debug(
      `Path ${bold(resolve(displayPath, wattConfiguration))} already exists. Skipping configuration management ...`
    )
    return
  }

  // Check which stackable we should use
  const { dependencies, devDependencies } = packageJson

  /* c8 ignore next 11 */
  let stackable = '@platformatic/node'

  if (dependencies?.next || devDependencies?.next) {
    stackable = '@platformatic/next'
  } else if (dependencies?.['@remix-run/dev'] || devDependencies?.['@remix-run/dev']) {
    stackable = '@platformatic/remix'
  } else if (dependencies?.vite || devDependencies?.vite) {
    stackable = '@platformatic/vite'
  } else if (dependencies?.astro || devDependencies?.astro) {
    stackable = '@platformatic/astro'
  }

  packageJson.dependencies ??= {}
  packageJson.dependencies[stackable] = `^${version}`

  const wattJson = {
    ...defaultServiceJson,
    $schema: `https://schemas.platformatic.dev/${stackable}/${version}.json`
  }

  logger.debug(`Detected stackable ${bold(stackable)}, adding to the service dependencies.`)
  await writeFile(resolve(path, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf-8')
  await writeFile(resolve(path, 'watt.json'), JSON.stringify(wattJson, null, 2), 'utf-8')
}

async function importURL (logger, root, configurationFile, values, rawUrl) {
  let url = rawUrl
  if (rawUrl.match(/^[a-z0-9-]+\/[a-z0-9-]+$/i)) {
    url = values.http ? `https://github.com/${rawUrl}.git` : `git@github.com:${rawUrl}.git`
  }

  const service = values.id ?? basename(rawUrl, '.git')
  const path = values.path ?? `web/${service}`

  await addService(configurationFile, service, path, url)
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
      },
      http: {
        type: 'boolean',
        short: 'h'
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

  // If the rawUrl exists as local folder, import a local folder, otherwise go for Git.
  // Try a relative from the root folder or from process.cwd()
  if (!URL.canParse(rawUrl)) {
    const local = [resolve(root, rawUrl), resolve(process.cwd(), rawUrl)].find(c => existsSync(c))

    if (local) {
      return importLocal(logger, root, configurationFile, local)
    }
  }

  return importURL(logger, root, configurationFile, values, rawUrl)
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
      },
      {
        usage: '-h, --http',
        description: 'Use HTTP URL when expanding GitHub repositories'
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
