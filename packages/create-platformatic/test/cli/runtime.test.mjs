import { deepStrictEqual, equal } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { isFileAccessible } from '../../src/utils.mjs'
import {
  createTemporaryDirectory,
  executeCreatePlatformatic,
  getServices,
  linkDependencies,
  setupUserInputHandler,
  startMarketplace
} from './helper.mjs'

test('Creates a Platformatic Runtime with two Services', async t => {
  const root = await createTemporaryDirectory(t, 'runtime')
  const marketplaceHost = await startMarketplace(t)

  // The actions must match IN ORDER
  const userInputHandler = await setupUserInputHandler(t, [
    { type: 'input', question: 'Where would you like to create your project?', reply: '.' },
    { type: 'list', question: 'Which kind of service do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the service?', reply: 'service1' },
    { type: 'list', question: 'Do you want to create another service?', reply: 'yes' },
    { type: 'list', question: 'Which kind of service do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the service?', reply: 'service2' },
    { type: 'list', question: 'Do you want to create another service?', reply: 'no' },
    { type: 'list', question: 'Which service should be exposed?', reply: 'service1' },
    { type: 'list', question: 'Do you want to use TypeScript?', reply: 'yes' },
    { type: 'input', question: 'What port do you want to use?', reply: '3042' },
    { type: 'list', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  // The actions must match IN ORDER
  await executeCreatePlatformatic(root, { pkgManager: 'pnpm', marketplaceHost, userInputHandler })

  equal(await isFileAccessible(join(root, '.gitignore')), true)
  equal(await isFileAccessible(join(root, '.env')), true)
  equal(await isFileAccessible(join(root, '.env.sample')), true)
  equal(await isFileAccessible(join(root, 'platformatic.json')), true)
  equal(await isFileAccessible(join(root, 'README.md')), true)

  // using pnpm will create workspace file
  equal(await isFileAccessible(join(root, 'pnpm-workspace.yaml')), true)

  // Here check the generated services
  const services = await getServices(join(root, 'services'))
  deepStrictEqual(services, ['service1', 'service2'])
  const baseService0Dir = join(root, 'services', services[0])
  equal(await isFileAccessible(join(baseService0Dir, 'platformatic.json')), true)
  equal(await isFileAccessible(join(baseService0Dir, 'README.md')), true)
  equal(await isFileAccessible(join(baseService0Dir, 'routes', 'root.ts')), true)
  equal(await isFileAccessible(join(baseService0Dir, 'plugins', 'example.ts')), true)
  equal(await isFileAccessible(join(baseService0Dir, 'global.d.ts')), true)

  const baseService1Dir = join(root, 'services', services[1])
  equal(await isFileAccessible(join(baseService1Dir, 'platformatic.json')), true)
  equal(await isFileAccessible(join(baseService1Dir, 'README.md')), true)
  equal(await isFileAccessible(join(baseService1Dir, 'routes', 'root.ts')), true)
  equal(await isFileAccessible(join(baseService1Dir, 'plugins', 'example.ts')), true)
  equal(await isFileAccessible(join(baseService1Dir, 'global.d.ts')), true)
})

test('Add another service to an existing application', async t => {
  const tmpDir = await createTemporaryDirectory(t, 'runtime')
  const root = join(tmpDir, 'platformatic')
  const marketplaceHost = await startMarketplace(t)

  {
    const userInputHandler = await setupUserInputHandler(t, [
      { type: 'input', question: 'Where would you like to create your project?', reply: 'platformatic' },
      { type: 'list', question: 'Which kind of service do you want to create?', reply: '@platformatic/service' },
      { type: 'input', question: 'What is the name of the service?', reply: 'service1' },
      { type: 'list', question: 'Do you want to create another service?', reply: 'no' },
      { type: 'list', question: 'Do you want to use TypeScript?', reply: 'no' },
      { type: 'input', question: 'What port do you want to use?', reply: '3042' },
      { type: 'list', question: 'Do you want to init the git repository?', reply: 'no' }
    ])

    await executeCreatePlatformatic(tmpDir, { pkgManager: 'pnpm', marketplaceHost, userInputHandler })

    equal(await isFileAccessible(join(root, '.gitignore')), true)
    equal(await isFileAccessible(join(root, '.env')), true)
    equal(await isFileAccessible(join(root, '.env.sample')), true)
    equal(await isFileAccessible(join(root, 'platformatic.json')), true)
    equal(await isFileAccessible(join(root, 'README.md')), true)

    // using pnpm will create workspace file
    equal(await isFileAccessible(join(root, 'pnpm-workspace.yaml')), true)

    // Here check the generated services
    const services = await getServices(join(root, 'services'))
    deepStrictEqual(services, ['service1'])
    const serviceRoot = join(root, 'services', services[0])
    equal(await isFileAccessible(join(serviceRoot, 'platformatic.json')), true)
    equal(await isFileAccessible(join(serviceRoot, 'README.md')), true)
    equal(await isFileAccessible(join(serviceRoot, 'routes', 'root.js')), true)
    equal(await isFileAccessible(join(serviceRoot, 'plugins', 'example.js')), true)
    equal(await isFileAccessible(join(serviceRoot, 'global.d.ts')), true)

    await linkDependencies(root, ['@platformatic/service'])
  }

  {
    // The actions must match IN ORDER
    const userInputHandler = await setupUserInputHandler(t, [
      { type: 'list', question: 'Which kind of service do you want to create?', reply: '@platformatic/service' },
      { type: 'input', question: 'What is the name of the service?', reply: 'service2' },
      { type: 'list', question: 'Do you want to create another service?', reply: 'no' },
      { type: 'list', question: 'Which service should be exposed?', reply: 'service1' },
      { type: 'list', question: 'Do you want to use TypeScript?', reply: 'yes' }
    ])

    // The actions must match IN ORDER
    await executeCreatePlatformatic(root, { pkgManager: 'pnpm', marketplaceHost, userInputHandler })

    // Here check the generated services
    const services = await getServices(join(root, 'services'))
    deepStrictEqual(services, ['service1', 'service2'])
    const serviceRoot = join(root, 'services', services[1])
    equal(await isFileAccessible(join(serviceRoot, 'platformatic.json')), true)
    equal(await isFileAccessible(join(serviceRoot, 'README.md')), true)
    equal(await isFileAccessible(join(serviceRoot, 'routes', 'root.ts')), true)
    equal(await isFileAccessible(join(serviceRoot, 'plugins', 'example.ts')), true)
    equal(await isFileAccessible(join(serviceRoot, 'global.d.ts')), true)
  }
})
