import {
  createDirectory,
  defaultPackageManager,
  detectApplicationType,
  findConfigurationFileRecursive,
  generateDashedName,
  getPackageManager,
  getPkgManager,
  loadConfigurationFile,
  searchJavascriptFiles
} from '@platformatic/foundation'
import { ImportGenerator } from '@platformatic/generators'
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
import { createGitRepository } from './git.js'
import { findGatewayConfigFile, getUsername, getVersion, say } from './utils.js'

const defaultCapabilities = [
  '@platformatic/node',
  '@platformatic/gateway',
  '@platformatic/next',
  '@platformatic/vite',
  '@platformatic/astro',
  '@platformatic/remix',
  '@platformatic/nest',
  '@platformatic/service',
  '@platformatic/db',
  '@platformatic/php',
  '@platformatic/ai-warp',
  '@platformatic/pg-hooks',
  '@platformatic/rabbitmq-hooks',
  '@platformatic/kafka-hooks'
]

export * from './git.js'
export * from './utils.js'

// This is used in tests to avoid npm installations
function applyPackagePathOverride (pkg, root) {
  const modulesPaths = process.env.PLT_MODULES_PATHS ? JSON.parse(process.env.PLT_MODULES_PATHS) : {}
  return modulesPaths[pkg] ? resolveModule.sync(modulesPaths[pkg], { basedir: root }) : pkg
}

async function getPackageVersion (pkg, projectDir) {
  let main
  try {
    pkg = applyPackagePathOverride(pkg, projectDir)
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

async function importOrLocal ({ pkgManager, projectDir, pkg }) {
  pkg = applyPackagePathOverride(pkg, projectDir)

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

    if (defaultCapabilities.includes(pkg) || pkg === '@platformatic/runtime') {
      // Let's find if we are using one of the default capabilities
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

export async function chooseCapability (inquirer, capabilities) {
  const options = await inquirer.prompt({
    type: 'list',
    name: 'type',
    message: 'Which kind of application do you want to create?',
    default: capabilities[0],
    choices: capabilities
  })

  return options.type
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
    await execa(packageManager, ['install'], {
      cwd: projectDir,
      stdio: 'inherit',
      reject: process.env.PLT_IGNORE_INSTALL_FAILURES !== 'true'
    })
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
    string: ['global-config', 'module']
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
  await createApplication(logger, pkgManager, modules, args['install'])
}

export async function createApplication (
  logger,
  packageManager,
  modules,
  install,
  additionalGeneratorOptions = {},
  additionalGeneratorConfig = {}
) {
  // This is only used for testing for now, but might be useful in the future
  const inquirer = process.env.PLT_USER_INPUT_HANDLER
    ? await import(process.env.PLT_USER_INPUT_HANDLER)
    : defaultInquirer

  // Check in the directory and its parents if there is a config file
  let shouldChooseProjectDir = true
  let projectDir = process.cwd()
  const runtimeConfigFile = await findConfigurationFileRecursive(projectDir, null, '@platformatic/runtime')

  if (runtimeConfigFile) {
    shouldChooseProjectDir = false
    projectDir = dirname(runtimeConfigFile)
  } else {
    // Check the current directory for suitable config files
    const applicationRoot = await findApplicationRoot(projectDir)

    if (applicationRoot) {
      // detectApplicationType cannot throw here as findApplicationRoot already checks for the existence of Javascript files
      const { name: module, label } = await detectApplicationType(projectDir)

      // Check if the file belongs to a Watt application, this can happen for instance if we executed watt create
      // in the applications folder
      const existingRuntime = await findConfigurationFileRecursive(applicationRoot, null, '@platformatic/runtime')

      if (!existingRuntime) {
        // If there is a watt.json file with a runtime property, we assume we already executed watt create and we exit.
        const existingApplication = await findGatewayConfigFile(projectDir)

        if (existingApplication) {
          const applicationConfig = await loadConfigurationFile(existingApplication)

          if (applicationConfig.runtime) {
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
          if (!packageManager) {
            packageManager = await getPackageManager(projectDir, defaultPackageManager)
          }

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

  if (!packageManager) {
    packageManager = await getPackageManager(projectDir, null, true)

    if (!packageManager) {
      const p = await inquirer.prompt({
        type: 'list',
        name: 'packageManager',
        message: 'Which package manager do you want to use?',
        default: defaultPackageManager,
        choices: [
          { name: 'npm', value: 'npm' },
          { name: 'pnpm', value: 'pnpm' },
          { name: 'yarn', value: 'yarn' }
        ]
      })

      packageManager = p.packageManager
    }
  }

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
    packageManager,
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

  const capabilities = Array.from(new Set([...modules, ...defaultCapabilities]))

  const names = generator.existingApplications ?? []

  while (true) {
    const capabilityName = await chooseCapability(inquirer, capabilities)
    // await say(`Creating a ${capability} project in ${projectDir}...`)

    const capability = await importOrLocal({
      pkgManager: packageManager,
      name: projectName,
      projectDir,
      pkg: capabilityName
    })

    const { applicationName } = await inquirer.prompt({
      type: 'input',
      name: 'applicationName',
      message: 'What is the name of the application?',
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

    names.push(applicationName)

    const capabilityGenerator = capability.Generator
      ? new capability.Generator({
          logger,
          inquirer,
          applicationName,
          parent: generator,
          ...additionalGeneratorOptions
        })
      : new ImportGenerator({
          logger,
          inquirer,
          applicationName,
          module: capabilityName,
          version: await getPackageVersion(capabilityName, projectDir),
          parent: generator,
          ...additionalGeneratorOptions
        })

    capabilityGenerator.setConfig({
      ...capabilityGenerator.config,
      ...additionalGeneratorConfig,
      applicationName
    })

    generator.addApplication(capabilityGenerator, applicationName)

    await capabilityGenerator.ask()

    const { shouldBreak } = await inquirer.prompt([
      {
        type: 'list',
        name: 'shouldBreak',
        message: 'Do you want to create another application?',
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
        message: 'Which application should be exposed?',
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
