import { getVersion, getDependencyVersion, convertServiceNameToPrefix } from '../utils.mjs'
import { createPackageJson } from '../create-package-json.mjs'
import { createGitignore } from '../create-gitignore.mjs'
import { getPkgManager } from '../get-pkg-manager.mjs'
import { join, relative, resolve } from 'path'
import inquirer from 'inquirer'
import { mkdir, stat } from 'fs/promises'
import pino from 'pino'
import pretty from 'pino-pretty'
import { execa } from 'execa'
import ora from 'ora'
import createRuntime from './create-runtime.mjs'
import askDir from '../ask-dir.mjs'
import { getPort, getRunPackageManagerInstall } from '../cli-options.mjs'
import generateName from 'boring-name-generator'
import { chooseKind } from '../index.mjs'
import { createReadme } from '../create-readme.mjs'

export async function createPlatformaticRuntime (_args) {
  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  const version = await getVersion()
  const pkgManager = getPkgManager()

  const projectDir = await askDir(logger, join('.', 'platformatic-runtime'))

  // checks directory
  try {
    await stat(projectDir)
    logger.error(`Directory ${projectDir} already exists. Please choose another path.`)
    process.exit(1)
  } catch (err) {}
  const toAsk = []
  // Create the project directory
  await mkdir(projectDir, { recursive: true })

  const baseServicesDir = join(relative(process.cwd(), projectDir), 'services')
  const servicesDir = await askDir(logger, baseServicesDir, 'Where would you like to load your services from?')

  // checks services dir is subdirectory
  const resolvedDir = resolve(projectDir, servicesDir)
  if (!resolvedDir.startsWith(projectDir)) {
    logger.error(`Services directory must be a subdirectory of ${projectDir}. Found: ${resolvedDir}.`)
    process.exit(1)
  }

  toAsk.push(getRunPackageManagerInstall(pkgManager))
  // const { runPackageManagerInstall } = await inquirer.prompt([
  //   getRunPackageManagerInstall(pkgManager)
  // ])

  toAsk.push({
    type: 'list',
    name: 'staticWorkspaceGitHubAction',
    message: 'Do you want to create the github action to deploy this application to Platformatic Cloud?',
    default: true,
    choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
  },
  {
    type: 'list',
    name: 'dynamicWorkspaceGitHubAction',
    message: 'Do you want to enable PR Previews in your application?',
    default: true,
    choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
  })

  const {
    runPackageManagerInstall,
    staticWorkspaceGitHubAction,
    dynamicWorkspaceGitHubAction
  } = await inquirer.prompt(toAsk)

  await mkdir(servicesDir, { recursive: true })

  const fastifyVersion = await getDependencyVersion('fastify')

  // Create the package.json, notes that we don't have the option for TS (yet) so we don't generate
  // the package.json with the TS build
  await createPackageJson(version, fastifyVersion, logger, projectDir, false)
  await createGitignore(logger, projectDir)
  await createReadme(logger, projectDir, 'runtime')

  logger.info('Let\'s create a first service!')

  const names = []
  while (true) {
    if (!await createRuntimeService({ servicesDir, names, logger })) {
      continue
    }

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

  const { port: entrypointPort } = await inquirer.prompt([getPort()])

  const params = {
    servicesDir,
    entrypoint,
    entrypointPort,
    staticWorkspaceGitHubAction,
    dynamicWorkspaceGitHubAction,
    serviceNames: names
  }

  await createRuntime(params, logger, projectDir, version)
  if (runPackageManagerInstall) {
    const spinner = ora('Installing dependencies...').start()
    await execa(pkgManager, ['install'], { cwd: projectDir })
    spinner.succeed()
  }
}

export async function createRuntimeService ({ servicesDir, names, logger }) {
  logger ||= pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))
  const { name } = await inquirer.prompt({
    type: 'input',
    name: 'name',
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

  names.push(name)

  const serviceDir = join(servicesDir, name)

  await chooseKind([], {
    skip: 'runtime',
    serviceName: name,
    dir: serviceDir,
    logger,
    skipGitHubActions: true,
    skipPackageJson: true,
    skipGitignore: true,
    port: '0',
    isRuntimeContext: true,
    runtimeContext: {
      servicesNames: names,
      envPrefix: convertServiceNameToPrefix(name)
    }
  })

  return true
}
