import { ensureLoggableError } from '@platformatic/utils'
import { bold } from 'colorette'
import { parse } from 'dotenv'
import { execa } from 'execa'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { rsort, satisfies } from 'semver'
import { packages } from '../packages.js'
import {
  buildRuntime,
  findConfigurationFile,
  getPackageArgs,
  getPackageManager,
  getRoot,
  loadConfigurationFile,
  logFatalError,
  parseArgs
} from '../utils.js'

// This function will not perform the command if the .npmrc file contains the 'dry-run' flag - This is useful in tests
async function executeCommand (root, ...args) {
  const npmrc = resolve(root, '.npmrc')
  if (existsSync(npmrc)) {
    try {
      const env = parse(await readFile(npmrc, 'utf8'))

      if (env['dry-run'] === 'true') {
        return
      }
      /* c8 ignore next 5 */
    } catch (error) {
      // No-op
    }
  }

  /* c8 ignore next - Mistakenly reported as uncovered by C8 */
  return execa(...args)
}

export async function installDependencies (logger, root, services, production, packageManager) {
  if (typeof services === 'string') {
    const config = await loadConfigurationFile(logger, services)
    services = config.services
  }

  if (!packageManager) {
    packageManager = getPackageManager(root)
  }

  const args = getPackageArgs(packageManager, production)

  // Install dependencies of the application
  try {
    logger.info(
      `Installing ${production ? 'production ' : ''}dependencies for the application using ${packageManager} ...`
    )

    await executeCommand(root, packageManager, args, { cwd: root, stdio: 'inherit' })
    /* c8 ignore next 4 */
  } catch (error) {
    return logFatalError(logger, { error: ensureLoggableError(error) }, 'Unable to install dependencies of the application.')
  }

  for (const service of services) {
    /* c8 ignore next */
    const servicePackageManager = service.packageManager ?? getPackageManager(service.path, packageManager)
    const servicePackageArgs = getPackageArgs(servicePackageManager, production)

    try {
      logger.info(
        `Installing ${production ? 'production ' : ''}dependencies for the service ${bold(service.id)} using ${servicePackageManager} ...`
      )

      await executeCommand(root, servicePackageManager, servicePackageArgs, {
        cwd: resolve(root, service.path),
        stdio: 'inherit'
      })
      /* c8 ignore next 6 */
    } catch (error) {
      return logFatalError(logger,
        { error: ensureLoggableError(error) },
        `Unable to install dependencies of the service ${bold(service.id)}.`
      )
    }
  }

  return true
}

async function updateDependencies (logger, latest, availableVersions, path, target, force) {
  // Parse the configuration file, if any
  const packageJsonPath = resolve(path, 'package.json')

  if (!existsSync(packageJsonPath)) {
    return false
  }

  let updated = false
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'))

  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const sectionLabel = section === 'dependencies' ? '' : ` (${bold(section)})`
    for (const [pkg, range] of Object.entries(packageJson[section] ?? {})) {
      let specifier = range[0]

      if (!packages.includes(pkg)) {
        continue
      }

      let newRange
      if (specifier !== '^' && specifier !== '~') {
        if (!force) {
          return logFatalError(logger,
            `Dependency ${bold(pkg)} of ${target}${sectionLabel} requires a non-updatable range ${bold(range)}. Try again with ${bold('-f/--force')} to update to the latest version.`
          )
        } else {
          specifier = ''
          newRange = latest
        }
      } else {
        newRange = availableVersions.find(v => satisfies(v, range))
      }

      // Nothing new, move on
      if (!newRange) {
        continue
      }

      newRange = specifier + newRange

      if (newRange && specifier + newRange !== range) {
        updated = true
        logger.info(
          `Updating dependency ${bold(pkg)} of ${target}${sectionLabel} from ${bold(range)} to ${bold(newRange)} ...`
        )

        packageJson[section][pkg] = newRange
      }
    }
  }

  if (updated) {
    await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2))
  }

  return true
}

export async function buildCommand (logger, args) {
  const { positionals } = parseArgs(args, {}, false)
  const root = getRoot(positionals)

  const configurationFile = await findConfigurationFile(logger, root)

  if (!configurationFile) {
    return
  }

  const runtime = await buildRuntime(logger, configurationFile)
  // Gather informations for all services before starting
  const { services } = await runtime.getServices()

  for (const { id } of services) {
    const currentLogger = logger.child({ name: id })
    currentLogger.debug(`Building service ${bold(id)} ...`)

    try {
      await runtime.buildService(id)
    } catch (error) {
      if (error.code === 'PLT_BASIC_NON_ZERO_EXIT_CODE') {
        currentLogger.error(`Building service "${id}" has failed with exit code ${error.exitCode}.`)
        /* c8 ignore next 6 */
      } else {
        currentLogger.error(
          { err: ensureLoggableError(error) },
          `Building service "${id}" has throw an exception: ${error.message}`
        )
      }

      process.exit(1)
    }
  }

  logger.done('All services have been built.')
  await runtime.close(true)
}

export async function installCommand (logger, args) {
  const {
    values: { production, 'package-manager': packageManager },
    positionals
  } = parseArgs(
    args,
    {
      production: {
        type: 'boolean',
        short: 'p',
        default: false
      },
      'package-manager': {
        type: 'string',
        short: 'P'
      }
    },
    false
  )

  const root = getRoot(positionals)
  const configurationFile = await findConfigurationFile(logger, root)

  if (!configurationFile) {
    return
  }

  const installed = await installDependencies(logger, root, configurationFile, production, packageManager)

  if (installed) {
    logger.done('All services have been resolved.')
  }
}

export async function updateCommand (logger, args) {
  const {
    positionals,
    values: { force }
  } = parseArgs(
    args,
    {
      force: {
        type: 'boolean',
        short: 'f'
      }
    },
    false
  )

  const root = getRoot(positionals)
  const configurationFile = await findConfigurationFile(logger, root)

  if (!configurationFile) {
    return
  }

  const { services } = await loadConfigurationFile(logger, configurationFile)

  // First of all, get all version from NPM for the runtime
  const selfInfoResponse = await fetch('https://registry.npmjs.org/@platformatic/runtime')

  if (!selfInfoResponse.ok) {
    return logFatalError(logger,
      { response: selfInfoResponse.status, body: await selfInfoResponse.text() },
      'Unable to fetch version information.'
    )
  }

  const selfInfo = await selfInfoResponse.json()
  const { latest } = selfInfo['dist-tags']

  const availableVersions = rsort(
    Object.values(selfInfo.versions)
      .filter(s => !s.deprecated)
      .map(s => s.version)
  )

  await updateDependencies(logger, latest, availableVersions, root, `the ${bold('application')}`, force)

  // Now, for all the services in the configuration file, update the dependencies
  for (const service of services) {
    await updateDependencies(logger, latest, availableVersions, service.path, `the service ${bold(service.id)}`, force)
  }

  logger.done('All dependencies have been updated.')
}

export const help = {
  build: {
    usage: 'build [root]',
    description: 'Builds all services of an application',
    args: [
      {
        name: 'root',
        description: 'The directory containing the application (the default is the current directory)'
      }
    ]
  },
  install: {
    usage: 'install [root]',
    description: 'Install all dependencies of an application and its services',
    args: [
      {
        name: 'root',
        description: 'The directory containing the application (the default is the current directory)'
      }
    ],
    options: [
      {
        usage: '-p --production',
        description: 'Only install production dependencies'
      },
      {
        usage: '-P, --package-manager <executable>',
        description: 'Use an alternative package manager (the default is to autodetect it)'
      }
    ]
  },
  update: {
    usage: 'update [root]',
    description: 'Updates all the Platformatic packages to the latest available version.',
    args: [
      {
        name: 'root',
        description: 'The directory containing the application (the default is the current directory)'
      }
    ],
    options: [
      {
        usage: '-f --force',
        description: 'Force dependencies update even if it violates the package.json version range'
      }
    ]
  }
}
