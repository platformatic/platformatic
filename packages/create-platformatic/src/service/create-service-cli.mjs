import { getVersion, getDependencyVersion } from '../utils.mjs'
import { createPackageJson } from '../create-package-json.mjs'
import { createGitignore } from '../create-gitignore.mjs'
import { getPkgManager } from '../get-pkg-manager.mjs'
import parseArgs from 'minimist'
import { join } from 'path'
import inquirer from 'inquirer'
import { mkdir, stat } from 'fs/promises'
import pino from 'pino'
import pretty from 'pino-pretty'
import { execa } from 'execa'
import ora from 'ora'
import createService from './create-service.mjs'
import askDir from '../ask-dir.mjs'
import { getRunPackageManagerInstall, getUseTypescript, getPort, getInitGitRepository } from '../cli-options.mjs'
import { createReadme } from '../create-readme.mjs'
import { createGitRepository } from '../create-git-repository.mjs'

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

  // checks directory
  try {
    await stat(projectDir)
    logger.error(`Directory ${projectDir} already exists. Please choose another path.`)
    process.exit(1)
  } catch (err) {}

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
  toAsk.push(getInitGitRepository())

  const {
    runPackageManagerInstall,
    useTypescript,
    port,
    staticWorkspaceGitHubAction,
    dynamicWorkspaceGitHubAction
  } = await inquirer.prompt(toAsk)

  // Create the project directory
  await mkdir(projectDir, { recursive: true })

  const params = {
    isRuntimeContext,
    hostname: args.hostname,
    port,
    typescript: useTypescript,
    staticWorkspaceGitHubAction,
    dynamicWorkspaceGitHubAction,
    runtimeContext: opts.runtimeContext
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
  if (!opts.skipGitRepository) {
    await createGitRepository(logger, projectDir)
  }

  if (runPackageManagerInstall) {
    const spinner = ora('Installing dependencies...').start()
    await execa(pkgManager, ['install'], { cwd: projectDir })
    spinner.succeed()
  }

  const spinner = ora('Generating types...').start()
  try {
    await execa(pkgManager, ['exec', 'platformatic', 'service', 'types'], { cwd: projectDir })
    spinner.succeed('Types generated!')
  } catch (err) {
    logger.trace({ err })
    spinner.fail('Failed to generate Types. Try again by running "platformatic service types"')
  }
}
export default createPlatformaticService
