import { test, beforeEach, afterEach } from 'tap'
import { executeCreatePlatformatic, keys, walk } from './helper.mjs'
import { isFileAccessible } from '../../src/utils.mjs'
import { join } from 'node:path'
import { tmpdir } from 'os'
import { mkdtemp, rm } from 'fs/promises'

let tmpDir
beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'test-create-platformatic-'))
})

afterEach(async () => {
  try {
    await rm(tmpDir, { recursive: true, force: true })
  } catch (e) {
    // on purpose, in win the resource might be still "busy"
  }
})

test('Creates a Platformatic Composer', async ({ equal, same, match, teardown }) => {
  // The actions must match IN ORDER
  const actions = [{
    match: 'Which kind of project do you want to create?',
    do: [keys.DOWN, keys.DOWN, keys.ENTER] // Composer
  }, {
    match: 'Where would you like to create your project?',
    do: [keys.ENTER]
  }, {
    match: 'What port do you want to use?',
    do: [keys.ENTER]
  }, {
    // NOTE THAT HERE THE DEFAULT OPTION FOR SERVICE IS "YES"
    match: 'Do you want to use TypeScript',
    do: [keys.DOWN, keys.ENTER] // no
  },
  {
    // create-platformatic uses pnpm in CI, so we need to match both options
    match: ['Do you want to run npm install?', 'Do you want to run pnpm install?'],
    do: [keys.DOWN, keys.ENTER] // no
  }, {
    match: 'Do you want to create the github action to deploy',
    do: [keys.DOWN, keys.ENTER] // no
  }, {
    match: 'Do you want to enable PR Previews in your application',
    do: [keys.DOWN, keys.ENTER] // no
  }, {
    match: 'Do you want to init the git repository',
    do: [keys.ENTER] // no
  }]
  await executeCreatePlatformatic(tmpDir, actions, 'All done!')

  const baseProjectDir = join(tmpDir, 'platformatic-composer')
  const files = await walk(baseProjectDir)
  console.log('==> created files', files)
  equal(await isFileAccessible(join(baseProjectDir, '.gitignore')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.env')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.env.sample')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'platformatic.composer.json')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'README.md')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'routes', 'root.js')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'plugins', 'example.js')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.github', 'workflows', 'platformatic-dynamic-workspace-deploy.yml')), false)
  equal(await isFileAccessible(join(baseProjectDir, '.github', 'workflows', 'platformatic-static-workspace-deploy.yml')), false)
  equal(await isFileAccessible(join(baseProjectDir, '.git', 'config')), false)
})

test('Creates a Platformatic Composer with typescript support adn GitHub Actions', async ({ equal, same, match, teardown }) => {
  // The actions must match IN ORDER
  const actions = [{
    match: 'Which kind of project do you want to create?',
    do: [keys.DOWN, keys.DOWN, keys.ENTER] // Composer
  }, {
    match: 'Where would you like to create your project?',
    do: [keys.ENTER]
  }, {
    match: 'What port do you want to use?',
    do: [keys.ENTER]
  }, {
    match: 'Do you want to use TypeScript',
    do: [keys.ENTER] // yes
  }, {
    // create-platformatic uses pnpm in CI, so we need to match both options
    match: ['Do you want to run npm install?', 'Do you want to run pnpm install?'],
    do: [keys.DOWN, keys.ENTER] // no
  }, {
    match: 'Do you want to create the github action to deploy',
    do: [keys.ENTER] // yes
  }, {
    match: 'Do you want to enable PR Previews in your application',
    do: [keys.ENTER] // yes
  }, {
    match: 'Do you want to init the git repository',
    do: [keys.DOWN, keys.ENTER] // yes
  }]
  await executeCreatePlatformatic(tmpDir, actions, 'All done!')

  const baseProjectDir = join(tmpDir, 'platformatic-composer')
  const files = await walk(baseProjectDir)
  console.log('==> created files', files)
  equal(await isFileAccessible(join(baseProjectDir, '.gitignore')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.env')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.env.sample')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'platformatic.composer.json')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'README.md')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'routes', 'root.ts')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'tsconfig.json')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'plugins', 'example.ts')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.github', 'workflows', 'platformatic-dynamic-workspace-deploy.yml')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.github', 'workflows', 'platformatic-static-workspace-deploy.yml')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.git', 'config')), true)
})
