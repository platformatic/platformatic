
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
import mkdirp from 'mkdirp'

export const createReadme = async (logger, dir = '.') => {
  const readmeFileName = join(dir, 'README.md')
  const isReadmeExists = await isFileAccessible(readmeFileName)
  if (!isReadmeExists) {
    const readmeFile = new URL('README.md', import.meta.url)
    const readme = await readFile(readmeFile, 'utf-8')
    await writeFile(readmeFileName, readme)
    logger.debug(`${readmeFileName} successfully created.`)
  } else {
    logger.debug(`${readmeFileName} found, skipping creation of README.md file.`)
  }
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

  // Create the project directory
  await mkdirp(projectDir)

  const params = {
    hostname: args.hostname,
    port: args.port
  }

  await createService(params, logger, projectDir)

  const fastifyVersion = await getDependencyVersion('fastify')

  // Create the package.json, .gitignore, readme
  await createPackageJson('service', version, fastifyVersion, logger, projectDir)
  await createGitignore(logger, projectDir)
  await createReadme(logger, projectDir)

  const { runPackageManagerInstall } = await inquirer.prompt([{
    type: 'list',
    name: 'runPackageManagerInstall',
    message: `Do you want to run ${pkgManager} install?`,
    default: true,
    choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
  }])

  if (runPackageManagerInstall) {
    const spinner = ora('Installing dependencies...').start()
    await execa(pkgManager, ['install'], { cwd: projectDir })
    spinner.succeed('...done!')
  }

  await askCreateGHAction(logger)
}

export default createPlatformaticService
