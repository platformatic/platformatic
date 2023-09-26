import { getVersion, getDependencyVersion, isFileAccessible } from '../utils.mjs'
import { createPackageJson } from '../create-package-json.mjs'
import { createGitignore } from '../create-gitignore.mjs'
import { getPkgManager } from '../get-pkg-manager.mjs'
import parseArgs from 'minimist'
import { join } from 'path'
import inquirer from 'inquirer'
import which from 'which'
import { readFile, writeFile, mkdir } from 'fs/promises'
import pino from 'pino'
import pretty from 'pino-pretty'
import { execa } from 'execa'
import ora from 'ora'
import { getConnectionString, createDB } from './create-db.mjs'
import askDir from '../ask-dir.mjs'
import { askDynamicWorkspaceCreateGHAction, askStaticWorkspaceGHAction } from '../ghaction.mjs'
import { getRunPackageManagerInstall, getUseTypescript, getPort, getOverwriteReadme } from '../cli-options.mjs'

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

export function parseDBArgs (_args) {
  return parseArgs(_args, {
    default: {
      hostname: '127.0.0.1',
      database: 'sqlite',
      migrations: 'migrations'
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

const createPlatformaticDB = async (_args, opts) => {
  const logger = opts.logger || pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  const args = parseDBArgs(_args)
  const version = await getVersion()
  const pkgManager = getPkgManager()
  const projectDir = opts.dir || await askDir(logger, '.')
  const isRuntimeContext = opts.isRuntimeContext || false

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
  const wizardPrompts = [{
    type: 'list',
    name: 'defaultMigrations',
    message: 'Do you want to create default migrations?',
    default: true,
    choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
  }]

  if (args.plugin === false) {
    wizardPrompts.push({
      type: 'list',
      name: 'generatePlugin',
      message: 'Do you want to create a plugin?',
      default: true,
      choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
    })
  }
  const wizardOptions = await inquirer.prompt(wizardPrompts, getUseTypescript(args.typescript))
  if (!isRuntimeContext) {
    const { port } = await inquirer.prompt([getPort(args.port)])
    wizardOptions.port = port
  }

  // Create the project directory
  await mkdir(projectDir, { recursive: true })

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
    typescript: useTypescript
  }

  const env = await createDB(params, logger, projectDir, version)

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
  await createReadme(logger, projectDir)

  let hasPlatformaticInstalled = false
  if (!opts.skipPackageJson) {
    const { runPackageManagerInstall } = await inquirer.prompt([
      getRunPackageManagerInstall(pkgManager)
    ])

    if (runPackageManagerInstall) {
      const spinner = ora('Installing dependencies...').start()
      await execa(pkgManager, ['install'], { cwd: projectDir })
      spinner.succeed('...done!')
      hasPlatformaticInstalled = true
    }
  }

  if (!hasPlatformaticInstalled) {
    try {
      const npmLs = JSON.parse(await execa('npm', ['ls', '--json']))
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
        try {
          await execa(pkgManager, ['exec', 'platformatic', 'db', 'migrations', 'apply'], { cwd: projectDir })
          spinner.succeed('...done!')
        } catch (err) {
          logger.trace({ err })
          spinner.fail('...failed! Try again by running "platformatic db migrations apply"')
        }
      }
    }
    if (generatePlugin) {
      const spinner = ora('Generating types...').start()
      try {
        await execa(pkgManager, ['exec', 'platformatic', 'db', 'types'], { cwd: projectDir })
        spinner.succeed('...done!')
      } catch (err) {
        logger.trace({ err })
        spinner.fail('...failed! Try again by running "platformatic db types"')
      }
    }
  }

  if (!opts.skipGitHubActions) {
    await askStaticWorkspaceGHAction(logger, env, 'db', useTypescript, projectDir)
    await askDynamicWorkspaceCreateGHAction(logger, env, 'db', useTypescript, projectDir)
  }
}

export default createPlatformaticDB
