import { configCandidates } from '@platformatic/basic'
import { ensureLoggableError } from '@platformatic/utils'
import { bold } from 'colorette'
import { parse } from 'dotenv'
import { execa } from 'execa'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { defaultServiceJson } from '../defaults.js'
import { version } from '../schema.js'
import {
  findConfigurationFile,
  loadConfigurationFile,
  loadRawConfigurationFile,
  overrideFatal,
  parseArgs,
  saveConfigurationFile,
  serviceToEnvVariable
} from '../utils.js'
import { installDependencies } from './build.js'

const originCandidates = ['origin', 'upstream']

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

  return { id: packageJson.name ?? basename(path), url, packageJson, stackable }
}

async function findExistingConfiguration (root, path) {
  for (const candidate of configCandidates) {
    const candidatePath = resolve(root, path, candidate)

    if (existsSync(candidatePath)) {
      return candidate
    }
  }
}

export async function appendEnvVariable (envFile, key, value) {
  let contents = ''

  if (existsSync(envFile)) {
    contents = await readFile(envFile, 'utf-8')

    if (contents.length && !contents.endsWith('\n')) {
      contents += '\n'
    }
  }

  contents += `${key}=${value}\n`

  return writeFile(envFile, contents, 'utf-8')
}

async function fixConfiguration (logger, root) {
  const configurationFile = await findConfigurationFile(logger, root)
  const config = await loadConfigurationFile(logger, configurationFile)

  // For each service, if there is no watt.json, create one and fix package dependencies
  for (const { path } of config.services) {
    const wattConfiguration = await findExistingConfiguration(root, path)

    /* c8 ignore next 3 */
    if (wattConfiguration) {
      continue
    }

    const { id, packageJson, stackable } = await parseLocalFolder(resolve(root, path))

    packageJson.dependencies ??= {}
    packageJson.dependencies[stackable] = `^${version}`

    const wattJson = {
      ...defaultServiceJson,
      $schema: `https://schemas.platformatic.dev/${stackable}/${version}.json`
    }

    logger.info(`Detected stackable ${bold(stackable)} for service ${bold(id)}, adding to the service dependencies.`)

    await saveConfigurationFile(logger, resolve(path, 'package.json'), packageJson)
    await saveConfigurationFile(logger, resolve(path, 'watt.json'), wattJson)
  }
}

async function importService (logger, configurationFile, id, path, url) {
  const config = await loadConfigurationFile(logger, configurationFile)
  const rawConfig = await loadRawConfigurationFile(logger, configurationFile)
  const root = dirname(configurationFile)
  const envFile = resolve(root, '.env')
  const envSampleFile = resolve(root, '.env.sample')
  const envVariable = serviceToEnvVariable(id)

  let useEnv = true

  // If there is a locale path
  if (path) {
    let autoloadPath = config.autoload?.path

    // If we already autoload this path, there is nothing to do
    if (autoloadPath) {
      autoloadPath = resolve(root, autoloadPath)
      if (path.startsWith(autoloadPath)) {
        logger.warn('The path is already autoloaded as a service.')
        return
      }
    }

    // If the path is within the application repository
    if (path.startsWith(root)) {
      // If the path is already defined as a service, there is nothing to do
      if (config.services.some(s => s.path === path)) {
        logger.warn('The path is already defined as a service.')
        return
      }

      // Do not use env variables
      useEnv = false
    }

    if (!url) {
      logger.warn(`The service ${bold(id)} does not define a Git repository.`)
    }
  }

  // Make sure the service is not already defined
  if (config.serviceMap.has(id)) {
    logger.fatal(`There is already a service ${bold(id)} defined, please choose a different service ID.`)
  }

  /* c8 ignore next */
  rawConfig.web ??= []

  if (useEnv) {
    rawConfig.web.push({ id, path: `{${envVariable}}`, url })

    // Make sure the environment variable is not already defined
    if (existsSync(envFile)) {
      const env = parse(await readFile(envFile, 'utf-8'))

      if (env[envVariable]) {
        logger.fatal(
          `There is already an environment variable ${bold(envVariable)} defined, please choose a different service ID.`
        )
      }
    }

    // Copy the .env file to .env.sample if it does not exist
    if (!existsSync(envSampleFile)) {
      await writeFile(envSampleFile, '', 'utf-8')
    }

    await appendEnvVariable(envFile, envVariable, path ?? '')
    await appendEnvVariable(envSampleFile, envVariable, '')
  } else {
    rawConfig.web.push({ id, path: relative(root, path) })
  }

  await saveConfigurationFile(logger, configurationFile, rawConfig)
}

async function importURL (logger, _, configurationFile, rawUrl, id, http) {
  let url = rawUrl
  if (rawUrl.match(/^[a-z0-9-]+\/[a-z0-9-]+$/i)) {
    url = http ? `https://github.com/${rawUrl}.git` : `git@github.com:${rawUrl}.git`
  }

  await importService(logger, configurationFile, id ?? basename(rawUrl, '.git'), null, url)
}

async function importLocal (logger, root, configurationFile, path, overridenId) {
  const { id, url, packageJson, stackable } = await parseLocalFolder(path)

  await importService(logger, configurationFile, overridenId ?? id, path, url)

  // Check if there is any configuration file we recognize. If so, don't do anything
  const wattConfiguration = await findExistingConfiguration(root, path)
  if (wattConfiguration) {
    /* c8 ignore next */
    const displayPath = isAbsolute(path) ? path : relative(root, path)

    logger.info(
      `Path ${bold(resolve(displayPath, wattConfiguration))} already exists. Skipping configuration management ...`
    )
    return
  }

  packageJson.dependencies ??= {}
  packageJson.dependencies[stackable] = `^${version}`

  const wattJson = {
    ...defaultServiceJson,
    $schema: `https://schemas.platformatic.dev/${stackable}/${version}.json`
  }

  logger.info(`Detected stackable ${bold(stackable)} for service ${bold(id)}, adding to the service dependencies.`)

  await saveConfigurationFile(logger, resolve(path, 'package.json'), packageJson)
  await saveConfigurationFile(logger, resolve(path, 'watt.json'), wattJson)
}

export async function resolveServices (
  logger,
  root,
  configurationFile,
  username,
  password,
  skipDependencies,
  packageManager
) {
  const config = await loadConfigurationFile(logger, configurationFile)

  /* c8 ignore next 8 */
  if (!packageManager) {
    if (existsSync(resolve(root, 'pnpm-lock.yaml'))) {
      packageManager = 'pnpm'
    } else {
      packageManager = 'npm'
    }
  }

  // The services which might be to be resolved are the one that have a URL and either
  // no path defined (which means no environment variable set) or a non-existing path (which means not resolved yet)
  const resolvableServices = config.services.filter(service => {
    if (!service.url) {
      return false
    }

    if (service.path && existsSync(service.path)) {
      logger.warn(`Skipping service ${bold(service.id)} as the path already exists.`)
      return false
    }

    return true
  })

  // Iterate the services a first time to verify the environment files configuration and which services must be resolved
  const toResolve = []

  // Simply use service.path here
  for (const service of resolvableServices) {
    if (!service.path) {
      service.path = resolve(root, `${config.resolvedServicesBasePath}/${service.id}`)
    }

    const directory = resolve(root, service.path)

    // If the directory already exists, it's either external or already resolved, nothing to do in both cases
    if (!existsSync(directory)) {
      if (!directory.startsWith(root)) {
        logger.warn(
          `Skipping service ${bold(service.id)} as the non existent directory ${bold(service.path)} is outside the project directory.`
        )
      } else {
        // This repository must be resolved
        toResolve.push(service)
      }
    } else {
      logger.warn(
        `Skipping service ${bold(service.id)} as the generated path ${bold(join(config.resolvedServicesBasePath, service.id))} already exists.`
      )
    }
  }

  // Resolve the services
  for (const service of toResolve) {
    const childLogger = logger.child({ name: service.id })
    overrideFatal(childLogger)

    try {
      const absolutePath = service.path
      const relativePath = relative(root, absolutePath)

      // Clone and install dependencies
      childLogger.info(`Resolving service ${bold(service.id)} ...`)

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

      await execa('git', ['clone', url, absolutePath])
    } catch (error) {
      childLogger.fatal(
        { error: ensureLoggableError(error) },
        `Unable to clone repository of the service ${bold(service.id)}`
      )
    }
  }

  // Install dependencies
  if (!skipDependencies) {
    await installDependencies(logger, root, toResolve, false, packageManager)
  }
}

export async function importCommand (logger, args) {
  const {
    values: { id, http },
    positionals
  } = parseArgs(
    args,
    {
      id: {
        type: 'string',
        short: 'i'
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

  /*
    No arguments = Fix configuration for existing services.
    One argument = URL
    Two arguments = root and URL
  */
  if (positionals.length === 0) {
    /* c8 ignore next */
    return fixConfiguration(logger, '')
  } else if (positionals.length === 1) {
    root = ''
    rawUrl = positionals[0]
  } else {
    root = positionals[0]
    rawUrl = positionals[1]
  }

  /* c8 ignore next */
  root = resolve(process.cwd(), root)

  const configurationFile = await findConfigurationFile(logger, root)

  // If the rawUrl exists as local folder, import a local folder, otherwise go for Git.
  // Try a relative from the root folder or from process.cwd().
  const local = [resolve(root, rawUrl), resolve(process.cwd(), rawUrl)].find(c => {
    return existsSync(c)
  })

  if (local) {
    return importLocal(logger, root, configurationFile, local, id)
  }

  return importURL(logger, root, configurationFile, rawUrl, id, http)
}

export async function resolveCommand (logger, args) {
  const {
    values: { username, password, 'skip-dependencies': skipDependencies, 'package-manager': packageManager },
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
      },
      'package-manager': {
        type: 'string',
        short: 'p'
      }
    },
    false
  )

  /* c8 ignore next */
  const root = resolve(process.cwd(), positionals[0] ?? '')
  const configurationFile = await findConfigurationFile(logger, root)

  await resolveServices(logger, root, configurationFile, username, password, skipDependencies, packageManager)
  logger.done('All services have been resolved.')
}

export const help = {
  import: {
    usage: 'import [root] [url]',
    description: 'Imports an external resource as a service',
    args: [
      {
        name: 'root',
        description: 'The directory containing the application (the default is the current directory)'
      },
      {
        name: 'url',
        description: 'The URL to import (can be in the form $USER/$REPOSITORY for GitHub repositories)'
      }
    ],
    options: [
      {
        usage: '-i, --id <value>',
        description: 'The id of the service (the default is the basename of the URL)'
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
        description: 'The directory containing the application (the default is the current directory)'
      }
    ],
    options: [
      {
        usage: '-u, --username <value>',
        description: 'The username to use for HTTP URLs'
      },
      {
        usage: '-p, --password <value>',
        description: 'The password to use for HTTP URLs'
      },
      {
        usage: '-s, --skip-dependencies',
        description: 'Do not install services dependencies'
      },
      {
        usage: 'P, --package-manager <executable>',
        description: 'Use an alternative package manager (the default is to autodetect it)'
      }
    ],
    footer: `
wattpm resolve command resolves runtime services that have the \`url\` in their configuration.
To change the directory where a service is cloned, you can set the \`path\` property in the service configuration.

After cloning the service, the resolve command will set the relative path to the service in the wattpm configuration file.

Example of the runtime \`watt.json\` configuration file:

\`\`\`json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/wattpm/2.0.0.json",
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

* \`watt.json\`, or
* \`platformatic.application.json\`, or
* \`platformatic.json\`, or
* \`watt.yaml\`, or
* \`platformatic.application.yaml\`, or
* \`platformatic.yaml\`, or
* \`watt.yml\`, or
* \`platformatic.application.yml\`, or
* \`platformatic.yml\`, or
* \`watt.toml\`, or
* \`platformatic.application.toml\`, or
* \`platformatic.toml\`, or
* \`watt.tml\`, or
* \`platformatic.application.tml\`, or
* \`platformatic.tml\`

You can find more details about the configuration format here:
* [Platformatic DB Configuration](https://docs.platformatic.dev/docs/db/configuration)
* [Platformatic Service Configuration](https://docs.platformatic.dev/docs/service/configuration)
    `
  }
}
