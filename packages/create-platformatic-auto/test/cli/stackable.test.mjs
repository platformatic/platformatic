import { test } from 'node:test'
import { equal } from 'node:assert'
import { executeCreatePlatformatic, keys, walk } from './helper.mjs'
import { timeout } from './timeout.mjs'
import { isFileAccessible } from '../../src/utils.mjs'
import { join } from 'node:path'
import { tmpdir } from 'os'
import { mkdtemp, rm } from 'node:fs/promises'

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

test('Creates a Platformatic Stackable without typescript', { timeout }, async () => {
  // The actions must match IN ORDER
  const actions = [{
    match: 'What kind of project do you want to create?',
    do: [keys.DOWN, keys.ENTER] // Stackable
  }, {
    match: 'Where would you like to create your project?',
    do: [keys.ENTER],
    waitAfter: 5000
  }, {
    match: 'Do you want to use TypeScript',
    do: [keys.ENTER] // no
  }, {
    match: 'Do you want to init the git repository',
    do: [keys.DOWN, keys.ENTER] // yes
  }]
  await executeCreatePlatformatic(tmpDir, actions, 'Stackable created successfully!')

  const baseProjectDir = join(tmpDir, 'platformatic')
  const files = await walk(baseProjectDir)
  console.log('==> created files', files)
  equal(await isFileAccessible(join(baseProjectDir, '.gitignore')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'index.js')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'index.d.ts')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'config.d.ts')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'package.json')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'plugins', 'example.js')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'lib', 'schema.js')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'lib', 'generator.js')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'cli', 'create.js')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'cli', 'start.js')), true)
})

test('Creates a Platformatic Stackable with typescript', { timeout }, async () => {
  // The actions must match IN ORDER
  const actions = [{
    match: 'What kind of project do you want to create?',
    do: [keys.DOWN, keys.ENTER] // Stackable
  }, {
    match: 'Where would you like to create your project?',
    do: [keys.ENTER],
    waitAfter: 5000
  }, {
    match: 'Do you want to use TypeScript',
    do: [keys.DOWN, keys.ENTER] // yes
  }, {
    match: 'Do you want to init the git repository',
    do: [keys.ENTER] // no
  }]
  await executeCreatePlatformatic(tmpDir, actions, 'Stackable created successfully!')

  const baseProjectDir = join(tmpDir, 'platformatic')
  const files = await walk(baseProjectDir)
  console.log('==> created files', files)
  equal(await isFileAccessible(join(baseProjectDir, '.gitignore')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'index.ts')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'index.d.ts')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'config.d.ts')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'package.json')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'plugins', 'example.ts')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'lib', 'schema.ts')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'lib', 'generator.ts')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'cli', 'create.ts')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'cli', 'start.ts')), true)
})
