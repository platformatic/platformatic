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
import { execa, execaNode } from 'execa'
import ora from 'ora'
import createDB from './create-db.mjs'
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

export const parseDBArgs = (_args) => {
  return parseArgs(_args, {
    default: {
      hostname: '127.0.0.1',
      port: 3042,
      database: 'sqlite',
      migrations: true,
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
    name: 'generateDefaultMigrations',
    message: 'Do you want to create default migrations?',
    default: args.migrations,
    choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
  }, {
    type: 'list',
    name: 'generatePlugin',
    message: 'Do you want to create a plugin?',
    default: args.plugin,
    choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
  }, {
    type: 'list',
    name: 'useTypescript',
    message: 'Do you want to use TypeScript?',
    default: args.typescript,
    choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
  }])

  // Create the project directory
  await mkdirp(projectDir)

  const { generateDefaultMigrations, generatePlugin, useTypescript } = wizardOptions
  const useTypes = args.types && generatePlugin // we set this always to true if we want to generate a plugin

  const params = {
    hostname: args.hostname,
    port: args.port,
    database: args.database,
    migrations: generateDefaultMigrations,
    plugin: generatePlugin,
    types: useTypes,
    typescript: useTypescript
  }

  const env = await createDB(params, logger, projectDir)

  const fastifyVersion = await getDependencyVersion('fastify')

  // Create the package.json, .gitignore, readme
  await createPackageJson('db', version, fastifyVersion, logger, projectDir, useTypescript)
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
        await execaNode('./node_modules/@platformatic/db/db.mjs', ['migrations', 'apply'], { cwd: projectDir })
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
        await execaNode('./node_modules/@platformatic/db/db.mjs', ['types'], { cwd: projectDir })
        spinner.succeed('...done!')
      }
    }
    await execaNode('./node_modules/@platformatic/db/db.mjs', ['schema', 'config'], { cwd: projectDir })
    logger.info('Configuration schema successfully created.')
  }
  await askCreateGHAction(logger, env, 'db', useTypescript)

  if (!runPackageManagerInstall) {
    logger.warn(`You must run the following commands in the project folder to complete the setup:
    - ${pkgManager} install
    - npx platformatic db schema config
`)
  }
}

export default createPlatformaticDB
