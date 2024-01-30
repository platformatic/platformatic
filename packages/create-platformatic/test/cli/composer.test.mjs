import { test } from 'node:test'
import { equal } from 'node:assert'
import { executeCreatePlatformatic, keys, walk, getServices } from './helper.mjs'
import { timeout } from './timeout.mjs'
import { isFileAccessible } from '../../src/utils.mjs'
import { join } from 'node:path'
import { tmpdir } from 'os'
import { mkdtemp, rm } from 'fs/promises'

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

test('Creates a Platformatic Composer', { timeout }, async () => {
  // The actions must match IN ORDER
  const actions = [{
    match: 'What kind of project do you want to create?',
    do: [keys.ENTER] // Application
  }, {
    match: 'Where would you like to create your project?',
    do: [keys.ENTER],
    waitAfter: 5000
  }, {
    match: 'Which kind of project do you want to create?',
    do: [keys.UP, keys.UP, keys.ENTER] // Composer
  }, {
    match: 'What is the name of the service?',
    do: [keys.ENTER]
  }, {
    match: 'Do you want to create another service?',
    do: [keys.DOWN, keys.ENTER] // no
  }, {
    // NOTE THAT HERE THE DEFAULT OPTION FOR SERVICE IS "YES"
    match: 'Do you want to use TypeScript',
    do: [keys.ENTER], // no
    waitAfter: 5000
  }, {
    match: 'What port do you want to use?',
    do: [keys.ENTER]
  }, {
    match: 'Do you want to init the git repository',
    do: [keys.DOWN, keys.ENTER] // yes
  }]
  await executeCreatePlatformatic(tmpDir, actions, 'You are all set!')

  const baseProjectDir = join(tmpDir, 'platformatic')
  const files = await walk(baseProjectDir)
  console.log('==> created files', files)
  equal(await isFileAccessible(join(baseProjectDir, '.gitignore')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.env')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.env.sample')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'platformatic.json')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'README.md')), true)

  // Here check the generated service
  const services = await getServices(join(baseProjectDir, 'services'))
  equal(services.length, 1)
  const baseServiceDir = join(baseProjectDir, 'services', services[0])
  console.log(baseServiceDir)
  equal(await isFileAccessible(join(baseServiceDir, 'platformatic.json')), true)
  equal(await isFileAccessible(join(baseServiceDir, 'README.md')), true)
  equal(await isFileAccessible(join(baseServiceDir, 'routes', 'root.js')), true)
  equal(await isFileAccessible(join(baseServiceDir, 'plugins', 'example.js')), true)
})
