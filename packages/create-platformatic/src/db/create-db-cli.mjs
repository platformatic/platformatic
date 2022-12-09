import { getVersion, getDependencyVersion, isFileAccessible } from '../utils.mjs'
import { createPackageJson } from '../create-package-json.mjs'
import { createGitignore } from '../create-gitignore.mjs'
import { getPkgManager } from '../get-pkg-manager.mjs'
import parseArgs from 'minimist'
import { join } from 'path'
import inquirer from 'inquirer'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import pino from 'pino'
import pretty from 'pino-pretty'
import { execa, execaNode } from 'execa'
import ora from 'ora'
import createDB from './create-db.mjs'
import askProjectDir from '../ask-project-dir.mjs'

export const createReadme = async (logger, dir = '.') => {
  const readmeFileName = join(dir, 'README.md')
  const isReadmeExists = await isFileAccessible(readmeFileName)
  if (!isReadmeExists) {
    const readmeFile = new URL('README.md', import.meta.url)
    const readme = readFileSync(readmeFile, 'utf-8')
    writeFileSync(readmeFileName, readme)
    logger.debug(`${readmeFileName} successfully created.`)
  } else {
    logger.debug(`${readmeFileName} found, skipping creation of README.md file.`)
  }
}

const createPlatformaticDB = async (_args) => {
  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  const args = parseArgs(_args, {
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

  const version = await getVersion()
  const pkgManager = getPkgManager()

  const projectDir = await askProjectDir(logger, './my-api')

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
  }, {
    type: 'list',
    when: !args.typescript,
    name: 'useTypescript',
    message: 'Do you want to use TypeScript?',
    default: args.typescript,
    choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
  }])

  // Create the project directory
  mkdirSync(projectDir)

  const generatePlugin = args.plugin || wizardOptions.generatePlugin
  const useTypescript = args.typescript || wizardOptions.useTypescript
  const useTypes = args.types || generatePlugin // we set this always to true if we want to generate a plugin

  const params = {
    hostname: args.hostname,
    port: args.port,
    database: args.database,
    migrations: args.migrations,
    plugin: generatePlugin,
    types: useTypes,
    typescript: useTypescript
  }

  await createDB(params, logger, projectDir)

  const fastifyVersion = await getDependencyVersion('fastify')

  // Create the package.json, .gitignore, readme
  await createPackageJson('db', version, fastifyVersion, logger, projectDir)
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
        // We need to applyu migration using the platformatic installed in the project
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
  }
}

export default createPlatformaticDB
