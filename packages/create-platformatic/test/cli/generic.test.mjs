import { deepStrictEqual, equal } from 'node:assert'
import { readFile } from 'node:fs/promises'
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

test('Support services with no generators', async t => {
  const fastify = import.meta.resolve('fastify')
  const fastifyVersion = JSON.parse(await readFile(new URL('./package.json', fastify), 'utf8')).version

  const version = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')).version

  const root = await createTemporaryDirectory(t, 'other')
  const marketplaceHost = await startMarketplace(t)

  // The actions must match IN ORDER
  const userInputHandler = await setupUserInputHandler(t, [
    { type: 'input', question: 'Where would you like to create your project?', reply: 'platformatic' },
    { type: 'list', question: 'Which kind of service do you want to create?', reply: '@platformatic/utils' },
    { type: 'input', question: 'What is the name of the service?', reply: 'utils' },
    { type: 'list', question: 'Do you want to create another service?', reply: 'yes' },
    { type: 'list', question: 'Which kind of service do you want to create?', reply: 'fastify' },
    { type: 'input', question: 'What is the name of the service?', reply: 'fastify' },
    { type: 'list', question: 'Do you want to create another service?', reply: 'no' },
    { type: 'list', question: 'Which service should be exposed?', reply: 'fastify' },
    { type: 'list', question: 'Do you want to use TypeScript?', reply: 'no' },
    { type: 'input', question: 'What port do you want to use?', reply: '3042' },
    { type: 'list', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  await executeCreatePlatformatic(root, {
    marketplaceHost,
    userInputHandler,
    args: ['--module=@platformatic/utils', '--module=fastify']
  })

  const baseProjectDir = join(root, 'platformatic')
  equal(await isFileAccessible(join(baseProjectDir, '.gitignore')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.env')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.env.sample')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'platformatic.json')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'README.md')), true)

  // Here check the generated service
  const services = await getServices(join(baseProjectDir, 'services'))
  deepStrictEqual(services, ['fastify', 'utils'])

  // Check generated files for the fastify service
  deepStrictEqual(JSON.parse(await readFile(join(baseProjectDir, 'services', services[0], 'package.json'), 'utf8')), {
    name: 'fastify',
    dependencies: {
      fastify: `^${fastifyVersion}`
    }
  })

  deepStrictEqual(JSON.parse(await readFile(join(baseProjectDir, 'services', services[0], 'watt.json'), 'utf8')), {
    module: 'fastify'
  })

  // Check generated files for the fastify service
  deepStrictEqual(JSON.parse(await readFile(join(baseProjectDir, 'services', services[1], 'package.json'), 'utf8')), {
    name: 'utils',
    dependencies: {
      '@platformatic/utils': `^${version}`
    }
  })

  deepStrictEqual(JSON.parse(await readFile(join(baseProjectDir, 'services', services[1], 'watt.json'), 'utf8')), {
    $schema: `https://schemas.platformatic.dev/@platformatic/utils/${version}.json`
  })
})
