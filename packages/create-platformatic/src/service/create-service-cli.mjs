
import { getVersion, getDependencyVersion, isFileAccessible } from '../utils.mjs'
import { createPackageJson } from '../create-package-json.mjs'
import { createGitignore } from '../create-gitignore.mjs'
import { getPkgManager } from '../get-pkg-manager.mjs'
import parseArgs from 'minimist'
import { join } from 'path'
import inquirer from 'inquirer'
import { readFile, writeFile } from 'fs/promises'
import pino from 'pino'
import pretty from 'pino-pretty'
import { execa } from 'execa'
import ora from 'ora'
import createService from './create-service.mjs'
import askProjectDir from '../ask-project-dir.mjs'
import { askCreateGHAction } from '../ghaction.mjs'
import { getRunPackageManagerInstall, getUseTypescript } from '../cli-options.mjs'
import mkdirp from 'mkdirp'

export const createReadme = async (logger, dir = '.') => {
  const readmeFileName = join(dir, 'README.md')
  let isReadmeExists = await isFileAccessible(readmeFileName)
  if (isReadmeExists) {
    logger.debug(`${readmeFileName} found, asking to overwrite it.`)
    const { shouldReplace } = await inquirer.prompt([{
      type: 'list',
      name: 'shouldReplace',
      message: 'Do you want to overwrite the existing README.md?',
      default: true,
      choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
    }])
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

const createPlatformaticService = async (_args) => {
  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  const args = parseArgs(_args, {
    default: {
      hostname: '127.0.0.1',
      port: 3042
    },
    alias: {
      h: 'hostname',
      p: 'port'
    }
  })

  const version = await getVersion()
  const pkgManager = getPkgManager()

  const projectDir = await askProjectDir(logger, '.')

  const { runPackageManagerInstall, useTypescript } = await inquirer.prompt([
    getRunPackageManagerInstall(pkgManager),
    getUseTypescript(args.typescript)
  ])

  // Create the project directory
  await mkdirp(projectDir)

  const params = {
    hostname: args.hostname,
    port: args.port,
    typescript: useTypescript
  }

  const env = await createService(params, logger, projectDir, version)

  const fastifyVersion = await getDependencyVersion('fastify')

  // Create the package.json, notes that we don't have the option for TS (yet) so we don't generate
  // the package.json with the TS build
  await createPackageJson('service', version, fastifyVersion, logger, projectDir, false)
  await createGitignore(logger, projectDir)
  await createReadme(logger, projectDir)

  if (runPackageManagerInstall) {
    const spinner = ora('Installing dependencies...').start()
    await execa(pkgManager, ['install'], { cwd: projectDir })
    spinner.succeed('...done!')
  }

  await askCreateGHAction(logger, env, 'service', useTypescript, projectDir)
}

export default createPlatformaticService
