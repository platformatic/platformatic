
import { say } from './say.mjs'
import { getUsername, getVersion, validatePath } from './utils.mjs'
import { createPackageJson } from './create-package-json.mjs'
import { createGitignore } from './create-gitignore.mjs'
import { createReadme } from './create-readme.mjs'
import { getPkgManager } from './get-pkg-manager.mjs'
import parseArgs from 'minimist'
import helpMe from 'help-me'
import { join } from 'desm'
import inquirer from 'inquirer'
import { mkdirSync, readFileSync } from 'node:fs'
import pino from 'pino'
import pretty from 'pino-pretty'
import { resolve, dirname, join as pathJoin } from 'path'
import { execa, execaNode } from 'execa'
import ora from 'ora'
import { createRequire } from 'module'

async function getDependencyVersion (dependencyName) {
  const require = createRequire(import.meta.url)
  const pathToPackageJson = pathJoin(dirname(require.resolve(dependencyName)), 'package.json')
  const packageJsonFile = readFileSync(pathToPackageJson, 'utf-8')
  const packageJson = JSON.parse(packageJsonFile)
  return packageJson.version
}

const createPlatformaticDB = async () => {
  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  const help = helpMe({
    dir: join(import.meta.url, '..', 'help'),
    ext: '.txt'
  })

  const args = parseArgs(process.argv.slice(2), {
    default: {
      hostname: '127.0.0.1',
      port: 3042,
      database: 'sqlite',
      migrations: 'migrations',
      types: true,
      typescript: false,
      help: false
    },
    alias: {
      h: 'hostname',
      p: 'port',
      db: 'database',
      m: 'migrations',
      t: 'types',
      ts: 'typescript'
    },
    boolean: ['types', 'typescript']
  })

  if (args.help) {
    await help.toStdout()
    process.exit(0)
  }

  const username = await getUsername()
  const version = await getVersion()
  const pkgManager = getPkgManager()
  const greeting = username ? `Hello, ${username}` : 'Hello,'
  await say(`${greeting} welcome to ${version ? `Platformatic ${version}!` : 'Platformatic!'}`)
  await say('Let\'s start by creating a new project.')

  const wizardOptions = await inquirer.prompt([{
    type: 'input',
    name: 'dir',
    message: 'Where would you like to create your project?',
    default: './my-api',
    validate: validatePath
  }, {
    type: 'list',
    name: 'migrations',
    message: 'Do you want to create default migrations?',
    default: true,
    choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
  }, {
    type: 'list',
    name: 'generatePlugin',
    message: 'Do you want to create a plugin?',
    default: false,
    choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
  }, {
    when: answers => (answers.generatePlugin),
    type: 'list',
    name: 'useTypescript',
    message: 'Do you want to use TypeScript?',
    default: false,
    choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
  }])

  // Create the project directory
  const projectDir = resolve(process.cwd(), wizardOptions.dir)
  mkdirSync(projectDir)

  const params = [
    '--hostname', args.hostname,
    '--port', args.port,
    '--database', args.database,
    '--migrations', wizardOptions.migrations ? args.migrations : '',
    '--plugin', wizardOptions.generatePlugin,
    '--types', wizardOptions.generatePlugin, // we set this always to true if we want to generate a plugin
    '--typescript', !!wizardOptions.useTypescript
  ]
  await execaNode(join(import.meta.url, '../node_modules/@platformatic/db/db.mjs'), ['init', ...params], { cwd: projectDir })

  const fastifyVersion = await getDependencyVersion('fastify')

  // Create the package.json, .gitignore, readme
  await createPackageJson(version, fastifyVersion, logger, projectDir)
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

  // if we don;t generate migrations, we don't ask to apply them (the folder might not exist)
  if (wizardOptions.migrations) {
    const { applyMigrations } = await inquirer.prompt([{
      type: 'list',
      name: 'applyMigrations',
      message: 'Do you want to apply migrations?',
      default: true,
      choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
    }])

    if (applyMigrations) {
      const spinner = ora('Applying migrations...').start()
      await execaNode(join(import.meta.url, '../node_modules/@platformatic/db/db.mjs'), ['migrations', 'apply'], { cwd: projectDir })
      spinner.succeed('...done!')
    }
  }

  await say('All done! Please open the project directory and check the README.')
}

export default createPlatformaticDB
