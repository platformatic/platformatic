import {
  ensureLoggableError,
  findRuntimeConfigurationFile,
  getInstallationCommand,
  getPackageManager,
  getRoot,
  logFatalError,
  parseArgs
} from '@platformatic/foundation'
import { deriveApplicationId, evaluateConfigurationFile, readPackageName } from '@platformatic/foundation/lib/v4/index.js'
import { loadConfiguration } from '@platformatic/runtime'
import { bold } from 'colorette'
import { execa } from 'execa'
import { existsSync } from 'node:fs'
import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { rsort, satisfies } from 'semver'
import { packages } from '../packages.js'

// This function will not perform the command if a .npmrc file contains the 'dry-run' flag - This is
// useful in tests. The whole ancestor chain is consulted, not just the command's own directory,
// because that is how the package managers themselves resolve .npmrc: a fixture that marks its root
// dry-run means it for every install inside it, including the one for an application in a
// subdirectory. Checking only the immediate directory let a sub-application install run for real --
// which, against a fixture whose dependencies are symlinked to a prerelease of the workspace, is a
// dependency graph npm cannot reconcile.
async function executeCommand (root, ...args) {
  let directory = resolve(root)

  while (true) {
    const npmrc = join(directory, '.npmrc')

    if (existsSync(npmrc)) {
      try {
        const contents = await readFile(npmrc, 'utf-8')
        if (contents.split(/\r?\n/).some(line => /^dry-run\s*=\s*true\s*$/.test(line))) {
          return
        }
        /* c8 ignore next 5 */
      } catch (error) {
        // No-op
      }
    }

    const parent = dirname(directory)
    if (parent === directory) {
      break
    }
    directory = parent
  }

  /* c8 ignore next - Mistakenly reported as uncovered by C8 */
  return execa(...args)
}

async function withTemporaryPnpmConfig (directory, fn) {
  const npmrc = resolve(directory, '.npmrc')
  const marker = 'minimum-release-age-exclude[]=@platformatic/*'
  let originalContents = null

  if (!existsSync(npmrc)) {
    await writeFile(npmrc, `${marker}\n`, 'utf-8')
  } else {
    const contents = await readFile(npmrc, 'utf-8')
    if (!contents.includes(marker)) {
      originalContents = contents
      const prefix = contents.endsWith('\n') || contents.length === 0 ? '' : '\n'
      await writeFile(npmrc, `${contents}${prefix}${marker}\n`, 'utf-8')
    }
  }

  try {
    return await fn()
  } finally {
    if (originalContents !== null) {
      await writeFile(npmrc, originalContents, 'utf-8')
    } else if (existsSync(npmrc)) {
      const contents = await readFile(npmrc, 'utf-8')
      if (contents === `${marker}\n`) {
        await rm(npmrc, { force: true })
      }
    }
  }
}

function isPathInsideDirectory (directory, path) {
  const relativePath = relative(directory, path)
  // Not a bare startsWith('..'): a directory legitimately named `..foo` relativizes to `..foo`.
  return (
    relativePath === '' ||
    (relativePath !== '..' && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath))
  )
}

/*
  Where a root says its applications are: the entries it lists, and the directories its autoload
  would discover. Neither answer needs an application's own configuration, which is the point.
*/
/*
  Where the applications are, without evaluating any of them. Every consumer of this is a command
  that repairs a project -- installing the capability an application is missing, or writing the
  configuration file it does not have -- so a full load would demand the very thing it is about to
  supply. The root states the paths by itself.
*/
export async function listApplicationDirectories (configurationFile) {
  const root = dirname(configurationFile)
  const { config } = await evaluateConfigurationFile({
    path: configurationFile,
    env: { ...process.env },
    command: 'start',
    production: false,
    role: 'root'
  })

  const entries = config.applications ?? config.services ?? config.web ?? []
  const applications = await Promise.all(
    entries
      .filter(entry => entry.path)
      .map(async entry => {
        /*
          The same three rungs the loader uses -- an explicit id, the package.json name with any
          scope stripped, then the directory name. Reading `entry.id` alone named a Level 1
          application `undefined`: the auto-wrapped entry a single-application file produces
          carries a path and no id, because the full loader derives it a step later than this
          reads.
        */
        const { id } = deriveApplicationId({
          id: entry.id,
          packageName: entry.id ? undefined : await readPackageName(entry.path),
          directory: entry.path
        })

        // packageManager comes along because installing is what this list is for, and the entry is
        // the only place that says which manager an application wants. moduleApplication marks an
        // entry that names an npm package as its capability -- the one shape install and update skip.
        return {
          id,
          path: entry.path,
          packageManager: entry.packageManager,
          moduleApplication: entry.module ? true : undefined
        }
      })
  )

  if (config.autoload?.path) {
    const exclude = config.autoload.exclude ?? []
    const directory = resolve(root, config.autoload.path)

    for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
      if (entry.isDirectory() && !exclude.includes(entry.name)) {
        applications.push({ id: entry.name, path: join(directory, entry.name) })
      }
    }
  }

  return applications
}

export async function installDependencies (logger, root, applications, production, packageManager) {
  // The path to the root configuration, resolved into the application list only after the root's own
  // dependencies are installed below -- because the root config imports `defineConfig` from wattpm,
  // so evaluating it to discover where the applications are needs wattpm present, which the root
  // install is what provides. Reading it first is what fails in a freshly scaffolded, not-yet-
  // installed project.
  const configurationFile = typeof applications === 'string' ? applications : null

  if (!packageManager) {
    packageManager = await getPackageManager(root)
  }

  const args = getInstallationCommand(packageManager, production)
  const isPnpmWorkspace = packageManager === 'pnpm' && existsSync(resolve(root, 'pnpm-workspace.yaml'))

  // Install dependencies of the application
  try {
    logger.info(`Installing ${production ? 'production ' : ''}dependencies for the project using ${packageManager} ...`)

    const installProjectDependencies = () => executeCommand(root, packageManager, args, {
      cwd: root,
      stdio: 'inherit',
      reject: process.env.PLT_IGNORE_INSTALL_FAILURES !== 'true'
    })

    if (packageManager === 'pnpm') {
      await withTemporaryPnpmConfig(root, installProjectDependencies)
    } else {
      await installProjectDependencies()
    }
    /* c8 ignore next 7 */
  } catch (error) {
    return logFatalError(
      logger,
      { error: ensureLoggableError(error) },
      'Unable to install dependencies of the application.'
    )
  }

  if (configurationFile !== null) {
    /*
      Now that the root's own dependencies are installed, the root configuration can be evaluated to
      learn where its applications are. Only the root is read -- an application's own configuration
      imports its capability, which the per-application install below is what provides, so those are
      never evaluated here.
    */
    if (!configurationFile.endsWith('.json')) {
      applications = await listApplicationDirectories(configurationFile)
    } else {
      const config = await loadConfiguration(configurationFile, null, { validate: false })

      /* c8 ignore next 3 - Hard to test */
      if (!config) {
        return
      }

      applications = config.applications
    }
  }

  for (let { id, path, moduleApplication, packageManager: applicationPackageManager } of applications) {
    // A module application's dependencies are installed in the Watt root and its package is not
    // writable. Keyed on moduleApplication, not module: every v4 application carries a module (its
    // capability), so module alone would skip them all.
    if (moduleApplication) {
      continue
    }

    const hasConfiguredPackageManager = !!applicationPackageManager
    applicationPackageManager ??= await getPackageManager(path, packageManager)
    const applicationPackageArgs = getInstallationCommand(applicationPackageManager, production)
    const applicationRoot = resolve(root, path)

    if (!hasConfiguredPackageManager && isPnpmWorkspace && applicationPackageManager === 'pnpm' && isPathInsideDirectory(root, applicationRoot)) {
      continue
    }

    try {
      logger.info(
        `Installing ${production ? 'production ' : ''}dependencies for the application ${bold(
          id
        )} using ${applicationPackageManager} ...`
      )

      // yarn v1 will skip folders that have no version field in their package.json, so we need to add it if it's missing
      if (applicationPackageManager === 'yarn') {
        const packageJsonPath = resolve(root, path, 'package.json')

        if (existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'))

          if (!packageJson.version) {
            logger.warn(
              `The package.json of the application ${bold(id)} is missing the ${bold('version')} field, which is required by yarn version. Setting version to 0.1.0 ...`
            )

            packageJson.version = '0.1.0'
            await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2))
          }
        }
      }

      const installApplicationDependencies = () => executeCommand(root, applicationPackageManager, applicationPackageArgs, {
        cwd: applicationRoot,
        stdio: 'inherit',
        reject: process.env.PLT_IGNORE_INSTALL_FAILURES !== 'true'
      })

      if (applicationPackageManager === 'pnpm') {
        await withTemporaryPnpmConfig(applicationRoot, installApplicationDependencies)
      } else {
        await installApplicationDependencies()
      }
      /* c8 ignore next 7 */
    } catch (error) {
      return logFatalError(
        logger,
        { error: ensureLoggableError(error) },
        `Unable to install dependencies of the application ${bold(id)}.`
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
          return logFatalError(
            logger,
            `Dependency ${bold(pkg)} of ${target}${sectionLabel} requires a non-updatable range ${bold(
              range
            )}. Try again with ${bold('-f/--force')} to update to the latest version.`
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

export async function installCommand (logger, args) {
  const {
    values: { config, production, 'package-manager': packageManager },
    positionals
  } = parseArgs(
    args,
    {
      config: {
        type: 'string',
        short: 'c'
      },
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
  const configurationFile = await findRuntimeConfigurationFile(
    logger,
    root,
    config,
    true,
    true,
    true,
    this.executableName
  )

  const installed = await installDependencies(
    logger,
    root,
    // Level 0: no configuration file anywhere, so the root directory is itself the one application
    // and there is nothing to read to find that out.
    configurationFile ?? [{ id: basename(resolve(root)), path: resolve(root) }],
    production,
    packageManager
  )

  if (installed) {
    logger.done('All applications have been resolved.')
  }
}

export async function updateCommand (logger, args) {
  const {
    positionals,
    values: { config, force }
  } = parseArgs(
    args,
    {
      config: {
        type: 'string',
        short: 'c'
      },
      force: {
        type: 'boolean',
        short: 'f'
      }
    },
    false
  )

  const root = getRoot(positionals)
  const configurationFile = await findRuntimeConfigurationFile(
    logger,
    root,
    config,
    true,
    true,
    true,
    this.executableName
  )

  // Level 0 again: the root is the one application, and it is the only thing to update besides
  // the project itself.
  let applications = [{ id: basename(resolve(root)), path: resolve(root) }]

  if (configurationFile) {
    const configuration = await loadConfiguration(configurationFile)

    /* c8 ignore next 3 - Hard to test */
    if (!configuration) {
      return
    }

    applications = configuration.applications
  }

  // First of all, get all version from NPM for the runtime
  const selfInfoResponse = await fetch('https://registry.npmjs.org/@platformatic/runtime')

  if (!selfInfoResponse.ok) {
    return logFatalError(
      logger,
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

  // Now, for all the applications in the configuration file, update the dependencies
  for (const application of applications) {
    // A module application has no writable package of its own. Keyed on moduleApplication, not
    // module: every v4 application carries a module (its capability), so module alone would skip all.
    if (application.moduleApplication) {
      continue
    }

    await updateDependencies(
      logger,
      latest,
      availableVersions,
      application.path,
      `the application ${bold(application.id)}`,
      force
    )
  }

  logger.done('All dependencies have been updated.')
}

export const help = {
  install: {
    usage: 'install [root]',
    description: 'Install all dependencies of an application and its applications',
    args: [
      {
        name: 'root',
        description: 'The directory containing the project (the default is the current directory)'
      }
    ],
    options: [
      {
        usage: '-c, --config <config>',
        description: 'Name of the configuration file to use (the default is to autodetect it)'
      },
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
    description: 'Updates all the Platformatic packages to the latest available version',
    args: [
      {
        name: 'root',
        description: 'The directory containing the project (the default is the current directory)'
      }
    ],
    options: [
      {
        usage: '-c, --config <config>',
        description: 'Name of the configuration file to use (the default is watt.json)'
      },
      {
        usage: '-f --force',
        description: 'Force dependencies update even if it violates the package.json version range'
      }
    ]
  }
}
