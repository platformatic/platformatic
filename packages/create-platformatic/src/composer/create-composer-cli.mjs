import { getVersion, getDependencyVersion, safeMkdir } from '../utils.mjs'
import { createPackageJson } from '../create-package-json.mjs'
import { createGitignore } from '../create-gitignore.mjs'
import { getPkgManager } from '../get-pkg-manager.mjs'
import parseArgs from 'minimist'
import inquirer from 'inquirer'
import pino from 'pino'
import pretty from 'pino-pretty'
import { execa } from 'execa'
import ora from 'ora'
import createComposer from './create-composer.mjs'
import askDir from '../ask-dir.mjs'
import { getPort, getUseTypescript, getInitGitRepository } from '../cli-options.mjs'
import { createReadme } from '../create-readme.mjs'
import { join } from 'path'

export const getServicesToCompose = (servicesNames) => {
  return {
    type: 'checkbox',
    name: 'servicesToCompose',
    message: 'Which services do you want to expose via Platformatic Composer?',
    choices: servicesNames,
    default: []
  }
}

const createPlatformaticComposer = async (_args, opts) => {
  const logger = opts.logger || pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  const args = parseArgs(_args, {
    default: {
      hostname: '127.0.0.1',
      install: true
    },
    alias: {
      h: 'hostname',
      p: 'port'
    },
    boolean: ['install']
  })

  const version = await getVersion()
  const pkgManager = getPkgManager()

  const projectDir = opts.dir || await askDir(logger, join('.', 'platformatic-composer'))
  const isRuntimeContext = opts.isRuntimeContext || false

  const toAsk = []

  // Ask for port if not in runtime context
  const portQuestion = getPort(args.port)
  portQuestion.when = !isRuntimeContext
  toAsk.push(portQuestion)
  toAsk.push(getUseTypescript(args.typescript))

  if (isRuntimeContext) {
    const servicesNames = opts.runtimeContext.servicesNames.filter(
      (serviceName) => serviceName !== opts.serviceName
    )
    if (servicesNames.length > 0) {
      toAsk.push(getServicesToCompose(servicesNames))
    }
  }

  if (!opts.skipGitHubActions) {
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
  }

  if (!opts.skipGitRepository) {
    toAsk.push(getInitGitRepository())
  }
  const {
    servicesToCompose,
    port,
    staticWorkspaceGitHubAction,
    dynamicWorkspaceGitHubAction,
    useTypescript,
    initGitRepository
  } = await inquirer.prompt(toAsk)

  // Create the project directory
  await safeMkdir(projectDir)

  const params = {
    isRuntimeContext,
    hostname: args.hostname,
    port,
    servicesToCompose,
    staticWorkspaceGitHubAction,
    dynamicWorkspaceGitHubAction,
    runtimeContext: opts.runtimeContext,
    typescript: useTypescript,
    initGitRepository
  }

  await createComposer(
    params,
    logger,
    projectDir,
    version
  )

  const fastifyVersion = await getDependencyVersion('fastify')

  // Create the package.json, notes that we don't have the option for TS (yet) so we don't generate
  // the package.json with the TS build
  if (!opts.skipPackageJson) {
    await createPackageJson(version, fastifyVersion, logger, projectDir, useTypescript)
  }
  if (!opts.skipGitignore) {
    await createGitignore(logger, projectDir)
  }
  await createReadme(logger, projectDir, 'composer')

  if (args.install && !opts.skipPackageJson) {
    const spinner = ora('Installing dependencies...').start()
    await execa(pkgManager, ['install'], { cwd: projectDir })
    spinner.succeed()
  }

  // returns metadata that can be used to make some further actions
  return {
    typescript: useTypescript
  }
}

export default createPlatformaticComposer
