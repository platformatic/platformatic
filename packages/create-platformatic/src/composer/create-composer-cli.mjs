import { getVersion, getDependencyVersion, isFileAccessible } from '../utils.mjs'
import { createPackageJson } from '../create-package-json.mjs'
import { createGitignore } from '../create-gitignore.mjs'
import { getPkgManager } from '../get-pkg-manager.mjs'
import parseArgs from 'minimist'
import { join } from 'path'
import inquirer from 'inquirer'
import { readFile, writeFile, mkdir } from 'fs/promises'
import pino from 'pino'
import pretty from 'pino-pretty'
import { execa } from 'execa'
import ora from 'ora'
import createComposer from './create-composer.mjs'
import askDir from '../ask-dir.mjs'
import { askDynamicWorkspaceCreateGHAction, askStaticWorkspaceGHAction } from '../ghaction.mjs'
import { getRunPackageManagerInstall, getPort, getOverwriteReadme } from '../cli-options.mjs'

export const createReadme = async (logger, dir = '.') => {
  const readmeFileName = join(dir, 'README.md')
  let isReadmeExists = await isFileAccessible(readmeFileName)
  if (isReadmeExists) {
    logger.debug(`${readmeFileName} found, asking to overwrite it.`)
    const { shouldReplace } = await inquirer.prompt([getOverwriteReadme()])
    isReadmeExists = !shouldReplace
  }

  if (isReadmeExists) {
    logger.debug(`${readmeFileName} found, skipping creation of README.md file.`)
    return
  }

  const readmeFile = new URL('README.md', import.meta.url)
  const readme = await readFile(readmeFile, 'utf-8')
  await writeFile(readmeFileName, readme)
  logger.debug(`${readmeFileName} successfully created.`)
}

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
      hostname: '127.0.0.1'
    },
    alias: {
      h: 'hostname',
      p: 'port'
    }
  })

  const version = await getVersion()
  const pkgManager = getPkgManager()

  const projectDir = opts.dir || await askDir(logger, '.')
  const isRuntimeContext = opts.isRuntimeContext || false

  const toAsk = [getPort(args.port)]

  if (isRuntimeContext) {
    const servicesNames = opts.runtimeContext.servicesNames.filter(
      (serviceName) => serviceName !== opts.serviceName
    )
    toAsk.push(getServicesToCompose(servicesNames))
  }

  if (!opts.skipPackageJson) {
    toAsk.push(getRunPackageManagerInstall(pkgManager))
  }

  const {
    runPackageManagerInstall,
    servicesToCompose,
    port
  } = await inquirer.prompt(toAsk)

  // Create the project directory
  await mkdir(projectDir, { recursive: true })

  const params = {
    hostname: args.hostname,
    port
  }

  const env = await createComposer(
    params,
    logger,
    projectDir,
    version,
    isRuntimeContext,
    servicesToCompose
  )

  const fastifyVersion = await getDependencyVersion('fastify')

  // Create the package.json, notes that we don't have the option for TS (yet) so we don't generate
  // the package.json with the TS build
  if (!opts.skipPackageJson) {
    await createPackageJson(version, fastifyVersion, logger, projectDir, false)
  }
  if (!opts.skipGitignore) {
    await createGitignore(logger, projectDir)
  }
  await createReadme(logger, projectDir)

  if (runPackageManagerInstall) {
    const spinner = ora('Installing dependencies...').start()
    await execa(pkgManager, ['install'], { cwd: projectDir })
    spinner.succeed('...done!')
  }

  if (!opts.skipGitHubActions) {
    await askStaticWorkspaceGHAction(logger, env, 'composer', false, projectDir)
    await askDynamicWorkspaceCreateGHAction(logger, env, 'composer', false, projectDir)
  }
}

export default createPlatformaticComposer
