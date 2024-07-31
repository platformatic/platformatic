import { test } from 'node:test'
import { equal } from 'node:assert'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, rm } from 'node:fs/promises'
import { timeout } from './timeout.mjs'
import { isFileAccessible } from '../../src/utils.mjs'
import {
  executeCreatePlatformatic,
  startMarketplace,
  keys,
  walk,
  getServices,
} from './helper.mjs'

let tmpDir
test.beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'test-create-platformatic-'))
})

test.afterEach(async () => {
  try {
    await rm(tmpDir, { recursive: true, force: true })
  } catch (e) {
    // on purpose, in win the resource might be still "busy"
  }
})

test('Creates a Platformatic Runtime with two Services', { timeout }, async (t) => {
  const marketplaceHost = await startMarketplace(t)
  // The actions must match IN ORDER
  const actions = [{
    match: 'What kind of project do you want to create?',
    do: [keys.ENTER], // Application
  }, {
    match: 'Where would you like to create your project?',
    do: [keys.ENTER],
    waitAfter: 8000,
  }, {
    match: 'Which kind of project do you want to create?',
    do: [keys.ENTER], // Service
  }, {
    match: 'What is the name of the service?',
    do: [keys.ENTER],
  }, {
    match: 'Do you want to create another service?',
    do: [keys.ENTER], // yes
  }, {
    match: 'Which kind of project do you want to create?',
    do: [keys.ENTER], // Service
  }, {
    match: 'What is the name of the service?',
    do: [keys.ENTER],
  }, {
    match: 'Do you want to create another service?',
    do: [keys.DOWN, keys.ENTER], // no
  }, {
    match: 'Which service should be exposed?',
    do: [keys.ENTER],
  }, {
    match: 'Do you want to use TypeScript',
    do: [keys.DOWN, keys.ENTER], // yes
  }, {
    match: 'What port do you want to use?',
    do: [keys.ENTER],
  }, {
    match: 'Do you want to init the git repository',
    do: [keys.DOWN, keys.ENTER], // yes
  }]
  await executeCreatePlatformatic(tmpDir, actions, {
    marketplaceHost,
    pkgManager: 'pnpm',
  })

  const baseProjectDir = join(tmpDir, 'platformatic')
  const files = await walk(baseProjectDir)
  console.log('==> created files', files)
  equal(await isFileAccessible(join(baseProjectDir, '.gitignore')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.env')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.env.sample')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'platformatic.json')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'README.md')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.git', 'config')), true)

  // using pnpm will create workspace file
  equal(await isFileAccessible(join(baseProjectDir, 'pnpm-workspace.yaml')), true)

  // Here check the generated services
  const services = await getServices(join(baseProjectDir, 'services'))
  equal(services.length, 2)
  const baseService0Dir = join(baseProjectDir, 'services', services[0])
  equal(await isFileAccessible(join(baseService0Dir, 'platformatic.json')), true)
  equal(await isFileAccessible(join(baseService0Dir, 'README.md')), true)
  equal(await isFileAccessible(join(baseService0Dir, 'routes', 'root.ts')), true)
  equal(await isFileAccessible(join(baseService0Dir, 'plugins', 'example.ts')), true)
  equal(await isFileAccessible(join(baseService0Dir, 'global.d.ts')), true)

  const baseService1Dir = join(baseProjectDir, 'services', services[1])
  equal(await isFileAccessible(join(baseService1Dir, 'platformatic.json')), true)
  equal(await isFileAccessible(join(baseService1Dir, 'README.md')), true)
  equal(await isFileAccessible(join(baseService1Dir, 'routes', 'root.ts')), true)
  equal(await isFileAccessible(join(baseService1Dir, 'plugins', 'example.ts')), true)
  equal(await isFileAccessible(join(baseService1Dir, 'global.d.ts')), true)
})
