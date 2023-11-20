import { getVersion, getDependencyVersion, safeMkdir } from '../utils.mjs'
import { createPackageJson } from '../create-package-json.mjs'
import { createGitignore } from '../create-gitignore.mjs'
import { getPkgManager } from '../get-pkg-manager.mjs'
import parseArgs from 'minimist'
import inquirer from 'inquirer'
import which from 'which'
import pino from 'pino'
import pretty from 'pino-pretty'
import { execa } from 'execa'
import ora from 'ora'
import { getConnectionString, createDB } from './create-db.mjs'
import askDir from '../ask-dir.mjs'
import { getUseTypescript, getPort, getInitGitRepository } from '../cli-options.mjs'
import { createReadme } from '../create-readme.mjs'
import { join } from 'node:path'

const databases = [{
  value: 'sqlite',
  name: 'SQLite'
}, {
  value: 'postgres',
  name: 'PostgreSQL'
}, {
  value: 'mysql',
  name: 'MySQL'
}, {
  value: 'mariadb',
  name: 'MariaDB'
}]

export function parseDBArgs (_args) {
  return parseArgs(_args, {
    default: {
      hostname: '127.0.0.1',
      database: 'sqlite',
      migrations: 'migrations',
      install: true
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
    boolean: ['plugin', 'types', 'typescript', 'install']
  })
}

const createPlatformaticDB = async (_args, opts) => {
  const logger = opts.logger || pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  const args = parseDBArgs(_args)
  const version = await getVersion()
  const pkgManager = getPkgManager()
  const projectDir = opts.dir || await askDir(logger, join('.', 'platformatic-db'))

  const isRuntimeContext = opts.isRuntimeContext || false
  const toAsk = []

  // Ask for port if not in runtime context
  const portQuestion = getPort(args.port)
  portQuestion.when = !isRuntimeContext
  toAsk.push(portQuestion)

  const { database } = await inquirer.prompt({
    type: 'list',
    name: 'database',
    message: 'What database do you want to use?',
    default: args.database,
    choices: databases
  })

  let connectionString = getConnectionString(database)

  while (true) {
    const pickConnectionString = await inquirer.prompt({
      type: 'expand',
      name: 'edit',
      message: `Do you want to use the connection string "${connectionString}"?`,
      choices: [
        {
          key: 'y',
          name: 'Confirm',
          value: false
        },
        {
          key: 'e',
          name: 'Edit',
          value: true
        }
      ]
    })

    if (pickConnectionString.edit) {
      const answers = await inquirer.prompt({
        type: 'editor',
        name: 'connectionString',
        message: 'Edit the connection string',
        default: connectionString
      })
      connectionString = answers.connectionString.trim()
    } else {
      break
    }
  }

  toAsk.push({
    type: 'list',
    name: 'defaultMigrations',
    message: 'Do you want to create default migrations?',
    default: true,
    choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
  })
  toAsk.push({
    type: 'list',
    name: 'applyMigrations',
    message: 'Do you want to apply migrations?',
    default: true,
    choices: [{ name: 'yes', value: true }, { name: 'no', value: false }],
    when: (answers) => {
      return answers.defaultMigrations
    }
  })

  if (args.plugin === false) {
    toAsk.push({
      type: 'list',
      name: 'generatePlugin',
      message: 'Do you want to create a plugin?',
      default: true,
      choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
    })
  }

  toAsk.push(getUseTypescript(args.typescript))

  toAsk.push({
    type: 'list',
    name: 'staticWorkspaceGitHubAction',
    message: 'Do you want to create the github action to deploy this application to Platformatic Cloud?',
    default: true,
    when: !opts.skipGitHubActions,
    choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
  },
  {
    type: 'list',
    name: 'dynamicWorkspaceGitHubAction',
    message: 'Do you want to enable PR Previews in your application?',
    default: true,
    when: !opts.skipGitHubActions,
    choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
  })
  if (!opts.skipGitRepository) {
    toAsk.push(getInitGitRepository())
  }
  // Prompt for questions
  const wizardOptions = await inquirer.prompt(toAsk)

  await safeMkdir(projectDir)

  const generatePlugin = args.plugin || wizardOptions.generatePlugin
  const useTypescript = args.typescript || wizardOptions.useTypescript
  const useTypes = args.types || generatePlugin // we set this always to true if we want to generate a plugin

  const params = {
    isRuntimeContext,
    hostname: args.hostname,
    port: wizardOptions.port,
    database,
    connectionString,
    migrations: wizardOptions.defaultMigrations ? args.migrations : '',
    plugin: generatePlugin,
    types: useTypes,
    typescript: useTypescript,
    staticWorkspaceGitHubAction: wizardOptions.staticWorkspaceGitHubAction,
    dynamicWorkspaceGitHubAction: wizardOptions.dynamicWorkspaceGitHubAction,
    runtimeContext: opts.runtimeContext,
    initGitRepository: wizardOptions.initGitRepository
  }

  await createDB(params, logger, projectDir, version)

  const fastifyVersion = await getDependencyVersion('fastify')

  const scripts = {
    migrate: 'platformatic db migrations apply',
    test: useTypescript ? 'tsc && node --test dist/test/*/*.test.js' : 'node --test test/*/*.test.js'
  }

  const dependencies = {
    '@platformatic/db': `^${version}`
  }

  // Create the package.json, .gitignore, readme
  await createPackageJson(version, fastifyVersion, logger, projectDir, useTypescript, scripts, dependencies)
  await createGitignore(logger, projectDir)
  await createReadme(logger, projectDir, 'db')

  let hasPlatformaticInstalled = false
  if (args.install && !opts.skipPackageJson) {
    const spinner = ora('Installing dependencies...').start()
    await execa(pkgManager, ['install'], { cwd: projectDir })
    spinner.succeed()
    hasPlatformaticInstalled = true
  }

  if (!hasPlatformaticInstalled) {
    try {
      const npmLs = JSON.parse(await execa('npm', ['ls', '--json']).toString())
      hasPlatformaticInstalled = !!npmLs.dependencies.platformatic
    } catch {
      // Ignore all errors, this can fail
    }
  }

  if (!hasPlatformaticInstalled) {
    const exe = await which('platformatic', { nothrow: true })
    hasPlatformaticInstalled = !!exe
  }

  if (hasPlatformaticInstalled) {
    // We applied package manager install, so we can:
    // - run the migrations
    // - generate types
    // if we don't generate migrations, we don't ask to apply them (the folder might not exist)
    let migrationApplied = false
    if (wizardOptions.defaultMigrations && wizardOptions.applyMigrations) {
      const spinner = ora('Applying migrations...').start()
      // We need to apply migrations using the platformatic installed in the project
      try {
        await execa(pkgManager, ['exec', 'platformatic', 'db', 'migrations', 'apply'], { cwd: projectDir })
        spinner.succeed()
        migrationApplied = true
      } catch (err) {
        logger.trace({ err })
        spinner.fail('Failed applying migrations! Try again by running "platformatic db migrations apply"')
      }
    }
    if (generatePlugin && migrationApplied) {
      const spinner = ora('Generating types...').start()
      try {
        await execa(pkgManager, ['exec', 'platformatic', 'db', 'types'], { cwd: projectDir })
        spinner.succeed()
      } catch (err) {
        logger.trace({ err })
        spinner.fail('Failed to generate Types. Try again by running "platformatic service types"')
      }
    }
  }
  // returns metadata that can be used to make some further actions
  return {
    typescript: useTypescript
  }
}

export default createPlatformaticDB
