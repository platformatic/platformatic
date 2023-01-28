import { say } from './say.mjs'
import helpMe from 'help-me'
import { join } from 'desm'
import inquirer from 'inquirer'
import createPlatformaticDB from './db/create-db-cli.mjs'
import createPlatformaticService from './service/create-service-cli.mjs'
import commist from 'commist'
import { getUsername, getVersion, minimumSupportedNodeVersions, isCurrentVersionSupported } from './utils.mjs'

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

  const result = program.parse(argv)

  if (result) {
    const username = await getUsername()
    const version = await getVersion()
    const greeting = username ? `Hello, ${username}` : 'Hello,'
    await say(`${greeting} welcome to ${version ? `Platformatic ${version}!` : 'Platformatic!'}`)
    await say('Let\'s start by creating a new project.')

    const currentVersion = process.versions.node
    const supported = isCurrentVersionSupported(currentVersion)
    if (!supported) {
      const supportedVersions = minimumSupportedNodeVersions.join(' or >= ')
      await say(`Platformatic is not supported on Node.js v${currentVersion}.`)
      await say(`Please use one of the following Node.js versions >= ${supportedVersions}.`)
    }

    const options = await inquirer.prompt({
      type: 'list',
      name: 'type',
      message: 'Which kind of project do you want to create?',
      default: 'db',
      choices: [{ name: 'DB', value: 'db' }, { name: 'Service', value: 'service' }]
    })

    if (options.type === 'db') {
      await createPlatformaticDB(argv)
    } else if (options.type === 'service') {
      await createPlatformaticService(argv)
    }

    await say('\nAll done! Please open the project directory and check the README.')
  }
}

export default createPlatformatic
