import { getVersion, getDependencyVersion, isFileAccessible } from '../utils.mjs'
import { createPackageJson } from '../create-package-json.mjs'
import { createGitignore } from '../create-gitignore.mjs'
import { getPkgManager } from '../get-pkg-manager.mjs'
import { join } from 'path'
import inquirer from 'inquirer'
import { readFile, writeFile, mkdir } from 'fs/promises'
import pino from 'pino'
import pretty from 'pino-pretty'
import { execa } from 'execa'
import ora from 'ora'
import createRuntime from './create-runtime.mjs'
import askDir from '../ask-dir.mjs'
import { askDynamicWorkspaceCreateGHAction, askStaticWorkspaceGHAction } from '../ghaction.mjs'
import { getOverwriteReadme, getRunPackageManagerInstall } from '../cli-options.mjs'
import generateName from 'boring-name-generator'
import { chooseKind } from '../index.mjs'

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

export async function createPlatformaticRuntime (_args) {
  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  const version = await getVersion()
  const pkgManager = getPkgManager()

  const projectDir = await askDir(logger, '.')
  const servicesDir = await askDir(logger, 'services', 'Where would you like to load your services from?')

  const { runPackageManagerInstall } = await inquirer.prompt([
    getRunPackageManagerInstall(pkgManager)
  ])

  // Create the project directory
  await mkdir(projectDir, { recursive: true })
  await mkdir(servicesDir, { recursive: true })

  const fastifyVersion = await getDependencyVersion('fastify')

  // Create the package.json, notes that we don't have the option for TS (yet) so we don't generate
  // the package.json with the TS build
  await createPackageJson(version, fastifyVersion, logger, projectDir, false)
  await createGitignore(logger, projectDir)
  await createReadme(logger, projectDir)

  if (runPackageManagerInstall) {
    const spinner = ora('Installing dependencies...').start()
    await execa(pkgManager, ['install'], { cwd: projectDir })
    spinner.succeed('...done!')
  }

  logger.info('Let\'s create a first service!')

  const names = []
  while (true) {
    if (!await createRuntimeService({ servicesDir, names, logger })) {
      continue
    }

    const { shouldBreak } = await inquirer.prompt([
      {
        type: 'list',
        name: 'shouldBreak',
        message: 'Do you want to create another service?',
        default: false,
        choices: [{ name: 'yes', value: false }, { name: 'no', value: true }]
      }
    ])

    if (shouldBreak) {
      break
    }
  }

  let entrypoint = ''

  if (names.length > 1) {
    const results = await inquirer.prompt([
      {
        type: 'list',
        name: 'entrypoint',
        message: 'Which service should be exposed?',
        choices: names.map(name => ({ name, value: name }))
      }
    ])
    entrypoint = results.entrypoint
  } else {
    entrypoint = names[0]
  }

  const env = await createRuntime(logger, projectDir, version, servicesDir, entrypoint)

  await askDynamicWorkspaceCreateGHAction(logger, env, 'service', false, projectDir)
  await askStaticWorkspaceGHAction(logger, env, 'service', false, projectDir)
}

export async function createRuntimeService ({ servicesDir, names, logger }) {
  logger ||= pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))
  const { name } = await inquirer.prompt({
    type: 'input',
    name: 'name',
    message: 'What is the name of the service?',
    default: generateName().dashed,
    validate: (value) => {
      if (value.length === 0) {
        return 'Please enter a name'
      }

      if (value.includes(' ')) {
        return 'Please enter a name without spaces'
      }

      if (names.includes(value)) {
        return 'This name is already used, please choose another one.'
      }

      return true
    }
  })

  names.push(name)

  const serviceDir = join(servicesDir, name)

  await chooseKind([], {
    skip: 'runtime',
    dir: serviceDir,
    logger,
    skipGitHubActions: true,
    skipPackageJson: true,
    skipGitignore: true,
    port: '0'
  })

  return true
}
