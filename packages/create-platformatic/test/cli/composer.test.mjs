import { deepStrictEqual, equal } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { isFileAccessible } from '../../src/utils.mjs'
import {
  createTemporaryDirectory,
  executeCreatePlatformatic,
  getServices,
  setupUserInputHandler,
  startMarketplace
} from './helper.mjs'

test('Creates a Platformatic Composer', async t => {
  const root = await createTemporaryDirectory(t, 'composer')
  const marketplaceHost = await startMarketplace(t)

  // The actions must match IN ORDER
  const userInputHandler = await setupUserInputHandler(t, [
    { type: 'input', question: 'Where would you like to create your project?', reply: 'platformatic' },
    { type: 'list', question: 'Which kind of service do you want to create?', reply: '@platformatic/composer' },
    { type: 'input', question: 'What is the name of the service?', reply: 'main' },
    { type: 'list', question: 'Do you want to create another service?', reply: 'no' },
    { type: 'list', question: 'Do you want to use TypeScript?', reply: 'no' },
    { type: 'input', question: 'What port do you want to use?', reply: '3042' },
    { type: 'list', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  await executeCreatePlatformatic(root, { marketplaceHost, userInputHandler })

  const baseProjectDir = join(root, 'platformatic')
  equal(await isFileAccessible(join(baseProjectDir, '.gitignore')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.env')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.env.sample')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'platformatic.json')), true)

  // Here check the generated service
  const services = await getServices(join(baseProjectDir, 'services'))
  deepStrictEqual(services, ['main'])
  const baseServiceDir = join(baseProjectDir, 'services', services[0])
  equal(await isFileAccessible(join(baseServiceDir, 'platformatic.json')), true)
  equal(await isFileAccessible(join(baseServiceDir, 'README.md')), true)
  equal(await isFileAccessible(join(baseServiceDir, 'routes', 'root.js')), false)
  equal(await isFileAccessible(join(baseServiceDir, 'plugins', 'example.js')), false)
})
