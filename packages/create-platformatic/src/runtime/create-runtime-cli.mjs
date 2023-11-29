import { getVersion, getDependencyVersion, convertServiceNameToPrefix, safeMkdir } from '../utils.mjs'
import { createPackageJson } from '../create-package-json.mjs'
import { createGitignore } from '../create-gitignore.mjs'
import { getPkgManager } from '@platformatic/utils'
import { join, relative, resolve } from 'path'
import inquirer from 'inquirer'
import pino from 'pino'
import pretty from 'pino-pretty'
import { execa } from 'execa'
import ora from 'ora'
import parseArgs from 'minimist'
import createRuntime from './create-runtime.mjs'
import askDir from '../ask-dir.mjs'
import { getInitGitRepository, getPort } from '../cli-options.mjs'
import generateName from 'boring-name-generator'
import { chooseKind } from '../index.mjs'
import { createReadme } from '../create-readme.mjs'

export async function createPlatformaticRuntime (_args) {
  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  const args = parseArgs(_args, {
    default: {
      install: true
    },
    boolean: ['install']
  })

  const version = await getVersion()
  const pkgManager = getPkgManager()

  const projectDir = await askDir(logger, join('.', 'platformatic-runtime'))

  const toAsk = []
  // Create the project directory
  await safeMkdir(projectDir)

  const baseServicesDir = join(relative(process.cwd(), projectDir), 'services')
  const servicesDir = await askDir(logger, baseServicesDir, 'Where would you like to load your services from?')

  // checks services dir is subdirectory
  const resolvedDir = resolve(projectDir, servicesDir)
  if (!resolvedDir.startsWith(projectDir)) {
    logger.error(`Services directory must be a subdirectory of ${projectDir}. Found: ${resolvedDir}.`)
    process.exit(1)
  }

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

  toAsk.push(getInitGitRepository())
  const {
    staticWorkspaceGitHubAction,
    dynamicWorkspaceGitHubAction,
    initGitRepository
  } = await inquirer.prompt(toAsk)

  await safeMkdir(servicesDir)

  const fastifyVersion = await getDependencyVersion('fastify')

  logger.info('Let\'s create a first service!')

  const names = []
  let addTypescriptDevDep = false
  while (true) {
    const serviceData = await createRuntimeService({ servicesDir, names, logger })
    if (!addTypescriptDevDep && serviceData.typescript) {
      addTypescriptDevDep = true
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
  const devDependencies = {}
  if (addTypescriptDevDep) {
    const typescriptVersion = await getDependencyVersion('typescript')
    devDependencies.typescript = `^${typescriptVersion}`
    devDependencies['@types/node'] = await getDependencyVersion('@types/node')
  }

  // Create the package.json, notes that we don't have the option for TS (yet) so we don't generate
  // the package.json with the TS build
  await createPackageJson(version, fastifyVersion, logger, projectDir, false, {}, {}, devDependencies)
  await createGitignore(logger, projectDir)
  await createReadme(logger, projectDir, 'runtime')

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
    serviceNames: names,
    initGitRepository,
    typescript: addTypescriptDevDep
  }

  await createRuntime(params, logger, projectDir, version)
  if (args.install) {
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

  const serviceData = await chooseKind([], {
    skip: 'runtime',
    serviceName: name,
    dir: serviceDir,
    logger,
    skipGitHubActions: true,
    skipPackageJson: true,
    skipGitignore: true,
    skipGitRepository: true,
    port: '0',
    isRuntimeContext: true,
    runtimeContext: {
      servicesNames: names,
      envPrefix: convertServiceNameToPrefix(name)
    }
  })

  return serviceData
}
