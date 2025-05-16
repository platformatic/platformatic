import { ConfigManager, saveConfigurationFile } from '@platformatic/config'
import { createDirectory, executeWithTimeout, generateDashedName, getPkgManager } from '@platformatic/utils'
import { execa } from 'execa'
import defaultInquirer from 'inquirer'
import parseArgs from 'minimist'
import { readFile, writeFile } from 'node:fs/promises'
import path, { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import ora from 'ora'
import pino from 'pino'
import pretty from 'pino-pretty'
import resolve from 'resolve'
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
    message: 'Which kind of project do you want to create?',
    default: stackables[0],
    choices: stackables
  })

  return options.type
}

async function importOrLocal ({ pkgManager, name, projectDir, pkg }) {
  try {
    return await import(pkg)
  } catch (err) {
    try {
      const fileToImport = resolve.sync(pkg, { basedir: projectDir })
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

    const spinner = ora(`Installing ${pkg + version}...`).start()
    await execa(pkgManager, ['install', pkg + version], { cwd: projectDir })
    spinner.succeed()

    const fileToImport = resolve.sync(pkg, { basedir: projectDir })
    return await import(pathToFileURL(fileToImport))
  }
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
  additionalGeneratorOptions = {}
) {
  // This is only used for testing for now, but might be useful in the future
  const inquirer = process.env.INQUIRER_PATH ? await import(process.env.INQUIRER_PATH) : defaultInquirer

  let projectDir = process.cwd()
  if (!(await ConfigManager.findConfigFile())) {
    const optionsDir = await inquirer.prompt({
      type: 'input',
      name: 'dir',
      message: 'Where would you like to create your project?',
      default: 'platformatic'
    })

    projectDir = path.resolve(process.cwd(), optionsDir.dir)
  }
  const projectName = basename(projectDir)

  await createDirectory(projectDir)

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

    const stackableGenerator = new stackable.Generator({
      logger,
      inquirer
    })

    stackableGenerator.setConfig({
      ...stackableGenerator.config,
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
  await generator.writeFiles()

  if (chooseEntrypoint) {
    // TODO(Paolo): this is a workaround, we should use the generator to write the config
    // test it via brand new generation of a project with multiple services
    const rootConfigPath = path.resolve(projectDir, generator.runtimeConfig)
    // TODO handle other formats
    const config = JSON.parse(await readFile(rootConfigPath, 'utf-8'))
    await saveConfigurationFile(rootConfigPath, {
      ...config,
      entrypoint
    })
  }

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
- 'services/*'`
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
