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
import createService from './create-service.mjs'
import askDir from '../ask-dir.mjs'
import { askDynamicWorkspaceCreateGHAction, askStaticWorkspaceGHAction } from '../ghaction.mjs'
import { getRunPackageManagerInstall, getUseTypescript, getPort, getOverwriteReadme } from '../cli-options.mjs'

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

  const projectDir = opts.dir || await askDir(logger, '.')

  const toAsk = [getUseTypescript(args.typescript), getPort(args.port)]

  if (!opts.skipPackageJson) {
    toAsk.unshift(getRunPackageManagerInstall(pkgManager))
  }

  const { runPackageManagerInstall, useTypescript, port } = await inquirer.prompt(toAsk)

  // Create the project directory
  await mkdir(projectDir, { recursive: true })

  const params = {
    hostname: args.hostname,
    port,
    typescript: useTypescript
  }

  const env = await createService(params, logger, projectDir, version)

  const fastifyVersion = await getDependencyVersion('fastify')

  if (!opts.skipPackageJson) {
    await createPackageJson(version, fastifyVersion, logger, projectDir, useTypescript, {}, {
      '@platformatic/service': '^' + version
    })
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
    await askDynamicWorkspaceCreateGHAction(logger, env, 'service', useTypescript, projectDir)
    await askStaticWorkspaceGHAction(logger, env, 'service', useTypescript, projectDir)
  }
}

export default createPlatformaticService
