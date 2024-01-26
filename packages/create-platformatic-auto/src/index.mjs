import { say } from './say.mjs'
import path, { basename, resolve } from 'node:path'
import inquirer from 'inquirer'
import generateName from 'boring-name-generator'
import { getUsername, getVersion, minimumSupportedNodeVersions, isCurrentVersionSupported, safeMkdir } from './utils.mjs'
import { createGitRepository } from './create-git-repository.mjs'
import { getPkgManager } from '@platformatic/utils'
import { StackableGenerator } from '@platformatic/generators'
import pino from 'pino'
import pretty from 'pino-pretty'
import { execa } from 'execa'
import parseArgs from 'minimist'
import ora from 'ora'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

export async function chooseStackable (opts = {}) {
  const choices = [
    { name: 'Composer', value: '@platformatic/composer' },
    { name: 'DB', value: '@platformatic/db' },
    { name: 'Service', value: '@platformatic/service' }
  ]

  const options = await inquirer.prompt({
    type: 'list',
    name: 'type',
    message: 'Which kind of project do you want to create?',
    default: choices[2].value,
    choices
  })

  // TODO contact the cloud for other stackables

  return options.type
}

async function importOrLocal ({ pkgManager, name, projectDir, pkg }) {
  try {
    return await import(pkg)
  } catch (err) {
    console.log(err)
    // This file does not need to exists, will be created automatically
    const pkgJsonPath = path.join(projectDir, 'package.json')
    const _require = createRequire(pkgJsonPath)

    try {
      const fileToImport = _require.resolve(pkg)
      return await import(pathToFileURL(fileToImport))
    } catch {}

    const spinner = ora(`Installing ${pkg}...`).start()
    await execa(pkgManager, ['install', pkg], { cwd: projectDir })
    spinner.succeed()

    const fileToImport = _require.resolve(pkg)
    return await import(pathToFileURL(fileToImport))
  }
}

export const createPlatformatic = async (argv) => {
  const args = parseArgs(argv, {
    default: {
      install: true
    },
    boolean: ['install']
  })

  const username = await getUsername()
  const version = await getVersion()
  const greeting = username ? `Hello ${username},` : 'Hello,'
  await say(`${greeting} welcome to ${version ? `Platformatic ${version}!` : 'Platformatic!'}`)

  const currentVersion = process.versions.node
  const supported = isCurrentVersionSupported(currentVersion)
  if (!supported) {
    const supportedVersions = minimumSupportedNodeVersions.join(' or >= ')
    await say(`Platformatic is not supported on Node.js v${currentVersion}.`)
    await say(`Please use one of the following Node.js versions >= ${supportedVersions}.`)
  }

  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  const pkgManager = getPkgManager()

  const { projectType } = await inquirer.prompt({
    type: 'list',
    name: 'projectType',
    message: 'What kind of project do you want to create?',
    default: 'application',
    choices: [
      { name: 'Application', value: 'application' },
      { name: 'Stackable', value: 'stackable' }
    ]
  })

  if (projectType === 'application') {
    await createApplication(args, logger, pkgManager)
  } else {
    await createStackable(args, logger, pkgManager)
  }
}

async function createApplication (args, logger, pkgManager) {
  const optionsDir = await inquirer.prompt({
    type: 'input',
    name: 'dir',
    message: 'Where would you like to create your project?',
    default: 'platformatic'
  })

  const projectDir = resolve(process.cwd(), optionsDir.dir)
  const projectName = basename(projectDir)

  await safeMkdir(projectDir)

  const runtime = await importOrLocal({
    pkgManager,
    name: projectName,
    projectDir,
    pkg: '@platformatic/runtime'
  })

  const generator = new runtime.Generator({
    logger,
    name: projectName,
    inquirer
  })
  generator.setConfig({
    ...generator.config,
    targetDirectory: projectDir
  })

  await generator.populateFromExistingConfig()
  if (generator.existingConfig) {
    await say('Using existing configuration')
  }

  const names = []

  while (true) {
    const stackableName = await chooseStackable()
    // await say(`Creating a ${stackable} project in ${projectDir}...`)

    const stackable = await importOrLocal({
      pkgManager,
      name: projectName,
      projectDir,
      pkg: stackableName
    })

    const { serviceName } = await inquirer.prompt({
      type: 'input',
      name: 'serviceName',
      message: 'What is the name of the service?',
      default: generateName().dashed,
      validate: (value) => {
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
      serviceName,
      plugin: true,
      tests: true
    })

    generator.addService(stackableGenerator, serviceName)

    await stackableGenerator.ask()

    const { shouldBreak } = await inquirer.prompt([
      {
        type: 'list',
        name: 'shouldBreak',
        message: 'Do you want to create another service?',
        default: false,
        choices: [{ name: 'yes', value: false }, { name: 'no', value: true }]
      }
    ])

    if (shouldBreak) {
      break
    }
  }

  let entrypoint = ''

  if (names.length > 1) {
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

  // Create project here

  const { initGitRepository } = await inquirer.prompt({
    type: 'list',
    name: 'initGitRepository',
    message: 'Do you want to init the git repository?',
    default: false,
    choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
  })

  if (initGitRepository) {
    await createGitRepository(logger, projectDir)
  }

  if (args.install) {
    const spinner = ora('Installing dependencies...').start()
    await execa(pkgManager, ['install'], { cwd: projectDir })
    spinner.succeed()
  }

  logger.info('Project created successfully, executing post-install actions...')
  await generator.postInstallActions()
  logger.info('You are all set! Run `npm start` to start your project.')
}

async function createStackable (args, logger, pkgManager) {
  logger.info('Creating a stackable project...')

  const generator = new StackableGenerator({ logger, inquirer })
  await generator.ask()
  await generator.prepare()
  await generator.writeFiles()

  const projectDir = resolve(process.cwd(), generator.config.targetDirectory)

  const { initGitRepository } = await inquirer.prompt({
    type: 'list',
    name: 'initGitRepository',
    message: 'Do you want to init the git repository?',
    default: false,
    choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
  })

  if (initGitRepository) {
    await createGitRepository(logger, projectDir)
  }

  if (args.install) {
    const spinner = ora('Installing dependencies...').start()
    await execa(pkgManager, ['install'], { cwd: projectDir })
    spinner.succeed()
  }

  await generator.postInstallActions()
  logger.info('Stackable created successfully! Run `npm run create` to create an application.')
}
