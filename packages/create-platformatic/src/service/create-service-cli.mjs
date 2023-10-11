import { getVersion, getDependencyVersion, safeMkdir } from '../utils.mjs'
import { createPackageJson } from '../create-package-json.mjs'
import { createGitignore } from '../create-gitignore.mjs'
import { getPkgManager } from '../get-pkg-manager.mjs'
import parseArgs from 'minimist'
import { join } from 'path'
import inquirer from 'inquirer'
import pino from 'pino'
import pretty from 'pino-pretty'
import { execa } from 'execa'
import ora from 'ora'
import createService from './create-service.mjs'
import askDir from '../ask-dir.mjs'
import { getRunPackageManagerInstall, getUseTypescript, getPort, getInitGitRepository } from '../cli-options.mjs'
import { createReadme } from '../create-readme.mjs'

const createPlatformaticService = async (_args, opts = {}) => {
  const logger = opts.logger || pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  const args = parseArgs(_args, {
    default: {
      hostname: '127.0.0.1'
    },
    alias: {
      h: 'hostname',
      p: 'port'
    }
  })

  const version = await getVersion()
  const pkgManager = getPkgManager()

  const projectDir = opts.dir || await askDir(logger, join('.', 'platformatic-service'))
  const isRuntimeContext = opts.isRuntimeContext || false

  const toAsk = []
  toAsk.push(getUseTypescript(args.typescript))

  if (!isRuntimeContext) {
    toAsk.push(getPort(args.port))
  }

  if (!opts.skipPackageJson) {
    toAsk.unshift(getRunPackageManagerInstall(pkgManager))
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
    runPackageManagerInstall,
    useTypescript,
    port,
    staticWorkspaceGitHubAction,
    dynamicWorkspaceGitHubAction,
    initGitRepository
  } = await inquirer.prompt(toAsk)

  // Create the project directory
  await safeMkdir(projectDir)

  const params = {
    isRuntimeContext,
    hostname: args.hostname,
    port,
    typescript: useTypescript,
    staticWorkspaceGitHubAction,
    dynamicWorkspaceGitHubAction,
    runtimeContext: opts.runtimeContext,
    initGitRepository
  }

  await createService(params, logger, projectDir, version)

  const fastifyVersion = await getDependencyVersion('fastify')

  if (!opts.skipPackageJson) {
    const test = useTypescript ? 'tsc && node --test dist/test/*/*.test.js' : 'node --test test/*/*.test.js'
    await createPackageJson(version, fastifyVersion, logger, projectDir, useTypescript, {
      test
    }, {
      '@platformatic/service': `^${version}`
    })
  }
  if (!opts.skipGitignore) {
    await createGitignore(logger, projectDir)
  }
  await createReadme(logger, projectDir, 'service')

  if (runPackageManagerInstall) {
    const spinner = ora('Installing dependencies...').start()
    await execa(pkgManager, ['install'], { cwd: projectDir })
    spinner.succeed()
  }

  const spinner = ora('Generating types...').start()
  try {
    const options = ['exec', 'platformatic', 'service', 'types']
    await execa(pkgManager, options, { cwd: projectDir })

    spinner.succeed('Types generated!')
  } catch (err) {
    logger.trace({ err })
    spinner.fail('Failed to generate Types. Try again by running "platformatic service types"')
  }
}
export default createPlatformaticService
