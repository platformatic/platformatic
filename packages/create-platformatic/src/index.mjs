import { say } from './say.mjs'
import helpMe from 'help-me'
import { join } from 'desm'
import inquirer from 'inquirer'
import { readdir, readFile } from 'fs/promises'
import createPlatformaticDB from './db/create-db-cli.mjs'
import createPlatformaticService from './service/create-service-cli.mjs'
import createPlatformaticComposer from './composer/create-composer-cli.mjs'
import { createPlatformaticRuntime, createRuntimeService } from './runtime/create-runtime-cli.mjs'
import commist from 'commist'
import { getUsername, getVersion, minimumSupportedNodeVersions, isCurrentVersionSupported, findRuntimeConfigFile, getDependencyVersion } from './utils.mjs'
import { createPackageJson } from './create-package-json.mjs'
import { createGitignore } from './create-gitignore.mjs'
import { createGitRepository } from './create-git-repository.mjs'

export async function chooseKind (argv, opts = {}) {
  const skip = opts.skip
  const choices = [
    { name: 'DB', value: 'db' },
    { name: 'Service', value: 'service' },
    { name: 'Composer', value: 'composer' },
    { name: 'Runtime', value: 'runtime' }
  ].filter((choice) => !skip || choice.value !== skip)

  const options = await inquirer.prompt({
    type: 'list',
    name: 'type',
    message: 'Which kind of project do you want to create?',
    choices
  })

  switch (options.type) {
    case 'db':
      return await createPlatformaticDB(argv, opts)
    case 'service':
      return await createPlatformaticService(argv, opts)
    case 'composer':
      return await createPlatformaticComposer(argv, opts)
    case 'runtime':
      await createPlatformaticRuntime(argv, opts)
      break
  }
}

const createPlatformatic = async (argv) => {
  const help = helpMe({
    dir: join(import.meta.url, '..', 'help'),
    ext: '.txt'
  })

  const program = commist({ maxDistance: 4 })

  program.register('help', help.toStdout)
  program.register('db help', help.toStdout.bind(null, ['db']))
  program.register('service help', help.toStdout.bind(null, ['service']))
  program.register('db', createPlatformaticDB)
  program.register('service', createPlatformaticService)
  program.register('composer', createPlatformaticComposer)
  program.register('runtime', createPlatformaticRuntime)

  const result = program.parse(argv)

  if (result) {
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

    const runtimeConfig = await findRuntimeConfigFile(process.cwd())
    if (runtimeConfig) {
      await say(`Found a ${runtimeConfig} file in the current directory.`)
      const config = JSON.parse(await readFile(runtimeConfig, 'utf8'))
      if (config.autoload?.path) {
        const servicesDir = config.autoload.path
        const names = []
        for (const entry of await readdir(servicesDir)) {
          names.push(entry)
        }
        if (!await createRuntimeService({ servicesDir, names })) {
          process.exit(1)
        }
      } else {
        await say('The current project does not have a services directory.')
        process.exit(1)
      }
    } else {
      await say('Let\'s start by creating a new project.')
      await chooseKind(argv)
    }

    await say('\nAll done! Please open the project directory and check the README.')
    await say('\nTo start your application run \'npm start\'.')
  }
}

export default createPlatformatic

export {
  createPackageJson,
  createGitignore,
  createGitRepository,
  getVersion,
  getDependencyVersion
}
