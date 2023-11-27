import { say } from './say.mjs'
import path, { basename } from 'node:path'
import inquirer from 'inquirer'
import { writeFile } from 'fs/promises'
import generateName from 'boring-name-generator'
import { getUsername, getVersion, minimumSupportedNodeVersions, isCurrentVersionSupported, safeMkdir, isFileAccessible } from './utils.mjs'
import { createGitignore } from './create-gitignore.mjs'
import { createGitRepository } from './create-git-repository.mjs'
import askDir from './ask-dir.mjs'
import { getPkgManager } from './get-pkg-manager.mjs'
import pino from 'pino'
import pretty from 'pino-pretty'
import { execa } from 'execa'
import parseArgs from 'minimist'
import ora from 'ora'

export async function chooseStackable (opts = {}) {
  const skip = opts.skip
  const choices = [
    { name: 'DB', value: '@platformatic/db' },
    { name: 'Service', value: '@platformatic/service' },
    { name: 'Composer', value: '@platformatic/composer' }
  ].filter((choice) => !skip || choice.value !== skip)

  const options = await inquirer.prompt({
    type: 'list',
    name: 'type',
    message: 'Which kind of project do you want to create?',
    choices
  })

  // TODO contact the cloud for other stackables

  return options.type
}

async function importOrLocal ({ pkgManager, name, projectDir, pkg }) {
  try {
    return await import(pkg)
  } catch (err) {
    console.log(err)
    if (!(await isFileAccessible('package.json', projectDir))) {
      await writeFile(path.join(projectDir, 'package.json'), JSON.stringify({
        name
      }))
    }
    const spinner = ora('Installing dependencies...').start()
    await execa(pkgManager, ['install', pkg], { cwd: projectDir })
    spinner.succeed()
  }
}

export const createPlatformatic = async (argv) => {
  const args = parseArgs(argv, {
    default: {
      install: true
    },
    boolean: ['install']
  })

  const username = await getUsername()
  const version = await getVersion()
  const greeting = username ? `Hello ${username},` : 'Hello,'
  await say(`${greeting} welcome to ${version ? `Platformatic ${version}!` : 'Platformatic!'}`)

  const currentVersion = process.versions.node
  const supported = isCurrentVersionSupported(currentVersion)
  if (!supported) {
    const supportedVersions = minimumSupportedNodeVersions.join(' or >= ')
    await say(`Platformatic is not supported on Node.js v${currentVersion}.`)
    await say(`Please use one of the following Node.js versions >= ${supportedVersions}.`)
  }

  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  const pkgManager = getPkgManager()

  const projectDir = await askDir(logger, path.join('.', 'platformatic'))
  const projectName = basename(projectDir)

  await safeMkdir(projectDir)

  await say('Installing platformatic and @platformatic/runtime')

  const runtime = await importOrLocal({
    pkgManager,
    name: projectName,
    projectDir,
    pkg: '@platformatic/runtime'
  })

  const generator = new runtime.Generator({
    name: projectName,
    inquirer
  })
  generator.setConfig({
    ...generator.config,
    targetDirectory: projectDir
  })

  const names = []

  while (true) {
    const stackableName = await chooseStackable()
    // await say(`Creating a ${stackable} project in ${projectDir}...`)

    const stackable = await importOrLocal({
      pkgManager,
      name: projectName,
      projectDir,
      pkg: stackableName
    })

    const { serviceName } = await inquirer.prompt({
      type: 'input',
      name: 'serviceName',
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

    names.push(serviceName)

    const stackableGenerator = new stackable.Generator({
      inquirer
    })

    stackableGenerator.setConfig({
      ...stackableGenerator.config,
      serviceName,
      plugin: true,
      tests: true
    })

    generator.addService(stackableGenerator, serviceName)

    await stackableGenerator.ask()

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

  generator.setEntryPoint(entrypoint)

  await generator.ask()
  await generator.prepare()
  await generator.writeFiles()

  // Create project here

  const { initGitRepository } = await inquirer.prompt({
    type: 'list',
    name: 'initGitRepository',
    message: 'Do you want to init the git repository?',
    default: false,
    choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
  })

  if (initGitRepository) {
    await createGitignore(logger, projectDir)
    await createGitRepository(logger, projectDir)
  }

  if (args.install) {
    const spinner = ora('Installing dependencies...').start()
    await execa(pkgManager, ['install'], { cwd: projectDir })
    spinner.succeed()
  }
}
