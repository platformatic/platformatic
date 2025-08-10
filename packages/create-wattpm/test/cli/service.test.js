import { createDirectory } from '@platformatic/foundation'
import { deepStrictEqual, equal, notEqual } from 'node:assert'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { isFileAccessible } from '../../lib/utils.js'
import {
  createTemporaryDirectory,
  executeCreatePlatformatic,
  getServices,
  setupUserInputHandler,
  startMarketplace
} from './helper.js'

test('Creates a Platformatic Service with no Typescript', async t => {
  const root = await createTemporaryDirectory(t, 'service')
  const marketplaceHost = await startMarketplace(t)

  // The actions must match IN ORDER
  const userInputHandler = await setupUserInputHandler(t, [
    { type: 'input', question: 'Where would you like to create your project?', reply: 'platformatic' },
    { type: 'list', question: 'Which kind of service do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the service?', reply: 'main' },
    { type: 'list', question: 'Do you want to use TypeScript?', reply: 'no' },
    { type: 'list', question: 'Do you want to create another service?', reply: 'no' },
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
  equal(await isFileAccessible(join(baseServiceDir, 'routes', 'root.js')), true)
  equal(await isFileAccessible(join(baseServiceDir, 'plugins', 'example.js')), true)
})

test('Creates a Platformatic Service with Typescript', async t => {
  const root = await createTemporaryDirectory(t, 'service')
  const marketplaceHost = await startMarketplace(t)

  // The actions must match IN ORDER
  const userInputHandler = await setupUserInputHandler(t, [
    { type: 'input', question: 'Where would you like to create your project?', reply: 'platformatic' },
    { type: 'list', question: 'Which kind of service do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the service?', reply: 'main' },
    { type: 'list', question: 'Do you want to use TypeScript?', reply: 'yes' },
    { type: 'list', question: 'Do you want to create another service?', reply: 'no' },
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
  equal(services.length, 1)
  const baseServiceDir = join(baseProjectDir, 'services', services[0])
  equal(await isFileAccessible(join(baseServiceDir, 'platformatic.json')), true)
  equal(await isFileAccessible(join(baseServiceDir, 'tsconfig.json')), true)
  equal(await isFileAccessible(join(baseServiceDir, 'README.md')), true)
  equal(await isFileAccessible(join(baseServiceDir, 'routes', 'root.ts')), true)
  equal(await isFileAccessible(join(baseServiceDir, 'plugins', 'example.ts')), true)
})

test('Creates a Platformatic Service in a non empty directory', async t => {
  const root = await createTemporaryDirectory(t, 'service')
  const marketplaceHost = await startMarketplace(t)

  const servicesDir = join(root, 'services')
  const serviceDir = join(servicesDir, 'foo')
  await createDirectory(servicesDir)
  await createDirectory(join(serviceDir, 'plugins'))
  await createDirectory(join(serviceDir, 'routes'))
  await writeFile(join(root, '.env'), 'SAMPLE_ENV=foobar\n')
  // creates 2 files. root.js will be overwritten
  await writeFile(join(serviceDir, 'routes', 'root.js'), "console.log('hello world')")
  await writeFile(join(serviceDir, 'routes', 'sample.js'), "console.log('hello world')")

  // The actions must match IN ORDER
  const userInputHandler = await setupUserInputHandler(t, [
    {
      type: 'list',
      question: 'This folder seems to already contain a Node.js application. Do you want to wrap into Watt?',
      reply: 'no'
    },
    { type: 'input', question: 'Where would you like to create your project?', reply: '.' },
    { type: 'list', question: 'Which kind of service do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the service?', reply: 'foo' },
    { type: 'list', question: 'Do you want to use TypeScript?', reply: 'no' },
    { type: 'list', question: 'Do you want to create another service?', reply: 'no' },
    { type: 'input', question: 'What port do you want to use?', reply: '3042' },
    { type: 'list', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  await executeCreatePlatformatic(root, { marketplaceHost, userInputHandler })

  equal(await isFileAccessible(join(root, '.gitignore')), true)
  equal(await isFileAccessible(join(root, '.env')), true)
  equal(await isFileAccessible(join(root, '.env.sample')), true)
  equal(await isFileAccessible(join(root, 'platformatic.json')), true)
  equal(await isFileAccessible(join(root, 'services/foo/routes/root.js')), true)
  equal(await isFileAccessible(join(root, 'services/foo/routes/sample.js')), true)
  equal(await isFileAccessible(join(root, 'services/foo/plugins/example.js')), true)

  // check file contents
  notEqual(await readFile(join(root, 'services/foo/routes/root.js'), 'utf8'), "console.log('hello world')")
  equal(await readFile(join(root, 'services/foo/routes/sample.js'), 'utf8'), "console.log('hello world')")
})
