import ConfigManager, { findConfigurationFile, loadConfigurationFile } from '@platformatic/config'
import { ImportGenerator } from '@platformatic/generators'
import {
  createDirectory,
  detectApplicationType,
  executeWithTimeout,
  generateDashedName,
  getPkgManager,
  searchJavascriptFiles
} from '@platformatic/utils'
import { execa } from 'execa'
import defaultInquirer from 'inquirer'
import parseArgs from 'minimist'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ora from 'ora'
import pino from 'pino'
import pretty from 'pino-pretty'
import resolveModule from 'resolve'
import { request } from 'undici'
import { createGitRepository } from './create-git-repository.mjs'
import { getUsername, getVersion, say } from './utils.mjs'
const MARKETPLACE_HOST = 'https://marketplace.platformatic.dev'
const defaultStackables = ['@platformatic/service', '@platformatic/composer', '@platformatic/db']

export async function fetchStackables (marketplaceHost, modules = []) {
  const stackables = new Set([...modules, ...defaultStackables])

  // Skip the remote network request if we are running tests
  if (process.env.MARKETPLACE_TEST) {
    return Array.from(stackables)
  }

  let response
  try {
    response = await executeWithTimeout(request(new URL('/templates', marketplaceHost || MARKETPLACE_HOST)), 5000)
  } catch (err) {
    // No-op: we just use the default stackables
  }

  if (response && response.statusCode === 200) {
    for (const stackable of await response.body.json()) {
      stackables.add(stackable.name)
    }
  }

  return Array.from(stackables)
}

export async function chooseStackable (inquirer, stackables) {
  const options = await inquirer.prompt({
    type: 'list',
    name: 'type',
    message: 'Which kind of service do you want to create?',
    default: stackables[0],
    choices: stackables
  })

  return options.type
}

async function getPackageVersion (pkg, projectDir) {
  let main
  try {
    main = import.meta.resolve(pkg)
  } catch {
    main = resolveModule.sync(pkg, { basedir: projectDir })
  }

  if (main.startsWith('file:')) {
    main = fileURLToPath(main)
  }

  let root = dirname(main)

  while (!existsSync(join(root, 'package.json'))) {
    const parent = dirname(root)

    if (parent === root) {
      // We reached the root of the filesystem
      throw new Error(`Could not find package.json for ${pkg}.`)
    }

    root = parent
  }

  const packageJsonPath = JSON.parse(await readFile(join(root, 'package.json'), 'utf-8'))
  return packageJsonPath.version
}

async function importOrLocal ({ pkgManager, name, projectDir, pkg }) {
  try {
    return await import(pkg)
  } catch (err) {
    try {
      const fileToImport = resolveModule.sync(pkg, { basedir: projectDir })
      return await import(pathToFileURL(fileToImport))
    } catch {
      // No-op
    }

    let version = ''

    if (defaultStackables.includes(pkg) || pkg === '@platformatic/runtime') {
      // Let's find if we are using one of the default stackables
      // If we are, we have to use the "local" version of the package

      const meta = await JSON.parse(await readFile(join(import.meta.dirname, '..', 'package.json'), 'utf-8'))
      if (meta.version.includes('-')) {
        version = `@${meta.version}`
      } else {
        version = `@^${meta.version}`
      }
    }

    const spinner = ora(`Installing ${pkg + version} using ${pkgManager} ...`).start()
    const args = []

    if (pkgManager === 'pnpm' && existsSync(resolve(projectDir, 'pnpm-workspace.yaml'))) {
      args.push('-w')
    }

    await execa(pkgManager, ['install', ...args, pkg + version], { cwd: projectDir })
    spinner.succeed()

    const fileToImport = resolveModule.sync(pkg, { basedir: projectDir })
    return await import(pathToFileURL(fileToImport))
  }
}

async function findApplicationRoot (projectDir) {
  if (existsSync(resolve(projectDir, 'package.json'))) {
    return projectDir
  }

  const files = await searchJavascriptFiles(projectDir)

  if (files.length > 0) {
    return dirname(resolve(projectDir, files[0]))
  }

  return null
}

export async function wrapApplication (
  logger,
  inquirer,
  packageManager,
  module,
  install,
  projectDir,
  additionalGeneratorOptions = {},
  additionalGeneratorConfig = {}
) {
  const projectName = basename(projectDir)

  const runtime = await importOrLocal({
    pkgManager: packageManager,
    name: projectName,
    projectDir,
    pkg: '@platformatic/runtime'
  })

  const generator = new runtime.WrappedGenerator({
    logger,
    module,
    name: projectName,
    inquirer,
    ...additionalGeneratorOptions
  })
  generator.setConfig({
    ...generator.config,
    ...additionalGeneratorConfig,
    targetDirectory: projectDir,
    typescript: false
  })

  await generator.ask()
  await generator.prepare()
  await generator.writeFiles()

  if (install) {
    logger.info(`Installing dependencies for the application using ${packageManager} ...`)
    await execa(packageManager, ['install'], { cwd: projectDir, stdio: 'inherit' })
  }

  logger.info(`You are all set! Run \`${packageManager} start\` to start your project.`)
}

export async function createPlatformatic (argv) {
  const args = parseArgs(argv, {
    default: {
      install: true,
      module: []
    },
    boolean: ['install'],
    string: ['global-config', 'marketplace-host', 'module']
  })

  const username = await getUsername()
  const version = await getVersion()
  const greeting = username ? `Hello ${username},` : 'Hello,'
  await say(`${greeting} welcome to ${version ? `Platformatic ${version}!` : 'Platformatic!'}`)

  const logger = pino(
    pretty({
      translateTime: 'SYS:HH:MM:ss',
      ignore: 'hostname,pid'
    })
  )

  const pkgManager = getPkgManager()
  const modules = Array.isArray(args.module) ? args.module : [args.module]
  await createApplication(logger, pkgManager, modules, args['marketplace-host'], args['install'])
}

export async function createApplication (
  logger,
  packageManager,
  modules,
  marketplaceHost,
  install,
  additionalGeneratorOptions = {},
  additionalGeneratorConfig = {}
) {
  // This is only used for testing for now, but might be useful in the future
  const inquirer = process.env.USER_INPUT_HANDLER ? await import(process.env.USER_INPUT_HANDLER) : defaultInquirer

  // Check in the directory and its parents if there is a config file
  let shouldChooseProjectDir = true
  let projectDir = process.cwd()
  const runtimeConfigFile = await findConfigurationFile(projectDir, null, 'runtime')

  if (runtimeConfigFile) {
    shouldChooseProjectDir = false
    projectDir = dirname(runtimeConfigFile)
  } else {
    // Check the current directory for suitable config files
    const applicationRoot = await findApplicationRoot(projectDir)

    if (applicationRoot) {
      const { name: module, label } = await detectApplicationType(projectDir)

      // Check if the file belongs to a Watt application, this can happen for instance if we executed watt create
      // in the services folder
      const existingRuntime = await findConfigurationFile(applicationRoot, null, 'runtime')

      if (!existingRuntime) {
        // If there is a watt.json file with a runtime property, we assume we already executed watt create and we exit.
        const existingService = await ConfigManager.findConfigFile(projectDir)

        if (existingService) {
          const serviceConfig = await loadConfigurationFile(existingService)

          if (serviceConfig.runtime) {
            await say(`The ${label} application has already been wrapped into Watt.`)
            return
          }
        }

        const { shouldWrap } = await inquirer.prompt({
          type: 'list',
          name: 'shouldWrap',
          message: `This folder seems to already contain a ${label} application. Do you want to wrap into Watt?`,
          // default: 'yes',
          choices: [
            { name: 'yes', value: true },
            { name: 'no', value: false }
          ]
        })

        if (shouldWrap) {
          return wrapApplication(
            logger,
            inquirer,
            packageManager,
            module,
            install,
            process.cwd(),
            additionalGeneratorOptions,
            { ...additionalGeneratorConfig, skipTypescript: true }
          )
        }
      } else {
        projectDir = dirname(existingRuntime)
        shouldChooseProjectDir = false
      }
    }
  }

  if (shouldChooseProjectDir) {
    const optionsDir = await inquirer.prompt({
      type: 'input',
      name: 'dir',
      message: 'Where would you like to create your project?',
      default: 'platformatic'
    })

    projectDir = resolve(process.cwd(), optionsDir.dir)
    await createDirectory(projectDir)
    process.chdir(projectDir)
  }

  const projectName = basename(projectDir)

  const runtime = await importOrLocal({
    pkgManager: packageManager,
    name: projectName,
    projectDir,
    pkg: '@platformatic/runtime'
  })

  const generator = new runtime.Generator({
    logger,
    name: projectName,
    inquirer,
    ...additionalGeneratorOptions
  })

  generator.setConfig({
    ...generator.config,
    ...additionalGeneratorConfig,
    targetDirectory: projectDir
  })

  await generator.populateFromExistingConfig()
  if (generator.existingConfig) {
    await say('Using existing configuration ...')
  }

  const stackables = await fetchStackables(marketplaceHost, modules)

  const names = generator.existingServices ?? []

  while (true) {
    const stackableName = await chooseStackable(inquirer, stackables)
    // await say(`Creating a ${stackable} project in ${projectDir}...`)

    const stackable = await importOrLocal({
      pkgManager: packageManager,
      name: projectName,
      projectDir,
      pkg: stackableName
    })

    const { serviceName } = await inquirer.prompt({
      type: 'input',
      name: 'serviceName',
      message: 'What is the name of the service?',
      default: generateDashedName(),
      validate: value => {
        if (value.length === 0) {
          return 'Please enter a name'
        }

        if (value.includes(' ')) {
          return 'Please enter a name without spaces'
        }

        if (names.includes(value)) {
          return 'This name is already used, please choose another one.'
        }

        return true
      }
    })

    names.push(serviceName)

    const stackableGenerator = stackable.Generator
      ? new stackable.Generator({
        logger,
        inquirer,
        serviceName,
        parent: generator,
        ...additionalGeneratorOptions
      })
      : new ImportGenerator({
        logger,
        inquirer,
        serviceName,
        module: stackableName,
        version: await getPackageVersion(stackableName, projectDir),
        parent: generator,
        ...additionalGeneratorOptions
      })

    stackableGenerator.setConfig({
      ...stackableGenerator.config,
      ...additionalGeneratorConfig,
      serviceName
    })

    generator.addService(stackableGenerator, serviceName)

    await stackableGenerator.ask()

    const { shouldBreak } = await inquirer.prompt([
      {
        type: 'list',
        name: 'shouldBreak',
        message: 'Do you want to create another service?',
        default: false,
        choices: [
          { name: 'yes', value: false },
          { name: 'no', value: true }
        ]
      }
    ])

    if (shouldBreak) {
      break
    }
  }

  let entrypoint = ''
  const chooseEntrypoint = names.length > 1 && (!generator.existingConfigRaw || !generator.existingConfigRaw.entrypoint)

  if (chooseEntrypoint) {
    const results = await inquirer.prompt([
      {
        type: 'list',
        name: 'entrypoint',
        message: 'Which service should be exposed?',
        choices: names.map(name => ({ name, value: name }))
      }
    ])
    entrypoint = results.entrypoint
  } else {
    entrypoint = names[0]
  }

  generator.setEntryPoint(entrypoint)

  await generator.ask()
  await generator.prepare()

  if (chooseEntrypoint) {
    await generator.updateConfigEntryPoint(entrypoint)
  }

  await generator.writeFiles()

  // Create project here
  if (!generator.existingConfigRaw) {
    const { initGitRepository } = await inquirer.prompt({
      type: 'list',
      name: 'initGitRepository',
      message: 'Do you want to init the git repository?',
      default: false,
      choices: [
        { name: 'yes', value: true },
        { name: 'no', value: false }
      ]
    })

    if (initGitRepository) {
      await createGitRepository(logger, projectDir)
    }
  }

  if (packageManager === 'pnpm') {
    // add pnpm-workspace.yaml file if needed
    const content = `packages:
# all packages in direct subdirs of packages/
- 'services/*'
- 'web/*'`
    await writeFile(join(projectDir, 'pnpm-workspace.yaml'), content)
  }

  if (typeof install === 'function') {
    await install(projectDir, generator.runtimeConfig, packageManager)
  } else if (install) {
    const spinner = ora('Installing dependencies...').start()
    await execa(packageManager, ['install'], { cwd: projectDir })
    spinner.succeed()
  }

  logger.info('Project created successfully, executing post-install actions...')
  await generator.postInstallActions()
  logger.info(`You are all set! Run \`${packageManager} start\` to start your project.`)
}
