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
import createDB from './create-db.mjs'
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

export const parseDBArgs = (_args) => {
  return parseArgs(_args, {
    default: {
      hostname: '127.0.0.1',
      port: 3042,
      database: 'sqlite',
      migrations: 'migrations',
      plugin: true,
      types: true,
      typescript: false
    },
    alias: {
      h: 'hostname',
      p: 'port',
      pl: 'plugin',
      db: 'database',
      m: 'migrations',
      t: 'types',
      ts: 'typescript'
    },
    boolean: ['plugin', 'types', 'typescript']
  })
}

const createPlatformaticDB = async (_args) => {
  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  const args = parseDBArgs(_args)
  const version = await getVersion()
  const pkgManager = getPkgManager()
  const projectDir = await askProjectDir(logger, '.')

  const wizardOptions = await inquirer.prompt([{
    type: 'list',
    name: 'defaultMigrations',
    message: 'Do you want to create default migrations?',
    default: true,
    choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
  }, {
    type: 'list',
    name: 'generatePlugin',
    message: 'Do you want to create a plugin?',
    default: args.plugin,
    choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
  },
  getUseTypescript(args.typescript)
  ])

  // Create the project directory
  await mkdirp(projectDir)

  const generatePlugin = args.plugin || wizardOptions.generatePlugin
  const useTypescript = args.typescript || wizardOptions.useTypescript
  const useTypes = args.types || generatePlugin // we set this always to true if we want to generate a plugin

  const params = {
    hostname: args.hostname,
    port: args.port,
    database: args.database,
    migrations: wizardOptions.defaultMigrations ? args.migrations : '',
    plugin: generatePlugin,
    types: useTypes,
    typescript: useTypescript
  }

  const env = await createDB(params, logger, projectDir, version)

  const fastifyVersion = await getDependencyVersion('fastify')

  // Create the package.json, .gitignore, readme
  await createPackageJson('db', version, fastifyVersion, logger, projectDir, useTypescript)
  await createGitignore(logger, projectDir)
  await createReadme(logger, projectDir)

  const { runPackageManagerInstall } = await inquirer.prompt([
    getRunPackageManagerInstall(pkgManager)
  ])

  if (runPackageManagerInstall) {
    const spinner = ora('Installing dependencies...').start()
    await execa(pkgManager, ['install'], { cwd: projectDir })
    spinner.succeed('...done!')
  }

  if (runPackageManagerInstall) {
    // We applied package manager install, so we can:
    // - run the migrations
    // - generate types
    // if we don't generate migrations, we don't ask to apply them (the folder might not exist)
    if (wizardOptions.defaultMigrations) {
      const { applyMigrations } = await inquirer.prompt([{
        type: 'list',
        name: 'applyMigrations',
        message: 'Do you want to apply migrations?',
        default: true,
        choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
      }])

      if (applyMigrations) {
        const spinner = ora('Applying migrations...').start()
        // We need to apply migrations using the platformatic installed in the project
        await execa(pkgManager, ['exec', 'platformatic', 'db', 'migrations', 'apply'], { cwd: projectDir })
        spinner.succeed('...done!')
      }
    }
    if (generatePlugin) {
      const { generateTypes } = await inquirer.prompt([{
        type: 'list',
        name: 'generateTypes',
        message: 'Do you want to generate types?',
        default: true,
        choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
      }])

      if (generateTypes) {
        const spinner = ora('Generating types...').start()
        await execa(pkgManager, ['exec', 'platformatic', 'db', 'types'], { cwd: projectDir })
        spinner.succeed('...done!')
      }
    }
  }
  await askCreateGHAction(logger, env, 'db', useTypescript, projectDir)
}

export default createPlatformaticDB
