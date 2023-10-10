import { test, beforeEach, afterEach } from 'tap'
import { executeCreatePlatformatic, keys, walk } from './helper.mjs'
import { mkdtempSync, rmSync } from 'fs'
import { isFileAccessible } from '../../src/utils.mjs'
import { join } from 'node:path'
import { tmpdir } from 'os'

let tmpDir
beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
})

afterEach(() => {
  try {
    rmSync(tmpDir, { recursive: true, force: true })
  } catch (e) {
    // on purpose, in win the resource might be still "busy"
  }
})

test('Creates a Platformatic DB service with no migrations and no plugin', async ({ equal, same, match, teardown }) => {
  // The actions must match IN ORDER
  const actions = [{
    match: 'Which kind of project do you want to create?',
    do: [keys.ENTER]
  }, {
    match: 'Where would you like to create your project?',
    do: [keys.ENTER]
  }, {
    match: 'What database do you want to use?',
    do: [keys.ENTER]
  }, {
    match: 'Do you want to use the connection string',
    do: ['y']
  }, {
    match: 'Confirm',
    do: [keys.ENTER]
  }, {
    match: 'What port do you want to use?',
    do: [keys.ENTER]
  }, {
    // create-platformatic uses pnpm in CI, so we need to match both options
    match: ['Do you want to run npm install?', 'Do you want to run pnpm install?'],
    do: [keys.DOWN, keys.ENTER]
  }, {
    match: 'Do you want to create default migrations',
    do: [keys.DOWN, keys.ENTER]
  }, {
    match: 'Do you want to create a plugin',
    do: [keys.DOWN, keys.ENTER]
  }, {
    // NOTE THAT HERE THE DEFAULT OPTION FOR DB IS "NO", so just sending ENTER we won't have TS
    match: 'Do you want to use TypeScript',
    do: [keys.ENTER]
  }, {
    match: 'Do you want to create the github action to deploy',
    do: [keys.DOWN, keys.ENTER]
  }, {
    match: 'Do you want to enable PR Previews in your application',
    do: [keys.DOWN, keys.ENTER]
  }, {
    match: 'Do you want to init the git repository',
    do: [keys.DOWN, keys.ENTER] // yes
  }]
  await executeCreatePlatformatic(tmpDir, actions, 'All done!')

  const baseProjectDir = join(tmpDir, 'platformatic-db')
  const files = await walk(baseProjectDir)
  console.log('==> created files', files)
  equal(await isFileAccessible(join(baseProjectDir, '.gitignore')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.env')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.env.sample')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'platformatic.db.json')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'README.md')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.git', 'config')), true)
})

test('Creates a Platformatic DB service with migrations and plugin', async ({ equal, same, match, teardown }) => {
  // The actions must match IN ORDER
  const actions = [{
    match: 'Which kind of project do you want to create?',
    do: [keys.ENTER]
  }, {
    match: 'Where would you like to create your project?',
    do: [keys.ENTER]
  }, {
    match: 'What database do you want to use?',
    do: [keys.ENTER]
  }, {
    match: 'Do you want to use the connection string',
    do: ['y']
  }, {
    match: 'Confirm',
    do: [keys.ENTER]
  }, {
    match: 'What port do you want to use?',
    do: [keys.ENTER]
  }, {
    // create-platformatic uses pnpm in CI, so we need to match both options
    match: ['Do you want to run npm install?', 'Do you want to run pnpm install?'],
    do: [keys.DOWN, keys.ENTER]
  }, {
    match: 'Do you want to create default migrations',
    do: [keys.ENTER]
  }, {
    match: 'Do you want to apply migrations',
    do: [keys.DOWN, keys.ENTER]
  }, {
    match: 'Do you want to create a plugin',
    do: [keys.ENTER]
  }, {
    // NOTE THAT HERE THE DEFAULT OPTION FOR DB IS "NO", so just sending ENTER we won't have TS
    match: 'Do you want to use TypeScript',
    do: [keys.ENTER]
  }, {
    match: 'Do you want to create the github action to deploy',
    do: [keys.DOWN, keys.ENTER]
  }, {
    match: 'Do you want to enable PR Previews in your application',
    do: [keys.DOWN, keys.ENTER]
  }, {
    match: 'Do you want to init the git repository',
    do: [keys.ENTER] // no
  }]
  await executeCreatePlatformatic(tmpDir, actions, 'All done!')

  const baseProjectDir = join(tmpDir, 'platformatic-db')
  const files = await walk(baseProjectDir)
  console.log('==> created files', files)
  equal(await isFileAccessible(join(baseProjectDir, '.gitignore')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.env')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.env.sample')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'platformatic.db.json')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'README.md')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'migrations')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'migrations', '001.do.sql')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'migrations', '001.undo.sql')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'plugins', 'example.js')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'routes', 'root.js')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'types', 'index.d.ts')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.git', 'config')), false)
})

test('Creates a Platformatic DB service with plugin using typescript, creating all the github actions', async ({ equal, same, match, teardown }) => {
  // The actions must match IN ORDER
  const actions = [{
    match: 'Which kind of project do you want to create?',
    do: [keys.ENTER]
  }, {
    match: 'Where would you like to create your project?',
    do: [keys.ENTER]
  }, {
    match: 'What database do you want to use?',
    do: [keys.ENTER]
  }, {
    match: 'Do you want to use the connection string',
    do: ['y']
  }, {
    match: 'Confirm',
    do: [keys.ENTER]
  }, {
    match: 'What port do you want to use?',
    do: [keys.ENTER]
  }, {
    // create-platformatic uses pnpm in CI, so we need to match both options
    match: ['Do you want to run npm install?', 'Do you want to run pnpm install?'],
    do: [keys.DOWN, keys.ENTER]
  }, {
    match: 'Do you want to create default migrations',
    do: [keys.ENTER]
  }, {
    match: 'Do you want to apply migrations',
    do: [keys.DOWN, keys.ENTER]
  }, {
    match: 'Do you want to create a plugin',
    do: [keys.ENTER]
  }, {
    // NOTE THAT HERE THE DEFAULT OPTION FOR DB IS "NO"
    match: 'Do you want to use TypeScript',
    do: [keys.UP, keys.ENTER]
  }, {
    match: 'Do you want to create the github action to deploy',
    do: [keys.ENTER]
  }, {
    match: 'Do you want to enable PR Previews in your application',
    do: [keys.ENTER]
  }, {
    match: 'Do you want to init the git repository',
    do: [keys.ENTER]
  }]
  await executeCreatePlatformatic(tmpDir, actions, 'All done!')

  const baseProjectDir = join(tmpDir, 'platformatic-db')
  const files = await walk(baseProjectDir)
  console.log('==> created files', files)
  equal(await isFileAccessible(join(baseProjectDir, '.gitignore')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.env')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.env.sample')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'platformatic.db.json')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'README.md')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'migrations')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'migrations', '001.do.sql')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'migrations', '001.undo.sql')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'plugins', 'example.ts')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'routes', 'root.ts')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'types', 'index.d.ts')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'global.d.ts')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'tsconfig.json')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.github', 'workflows', 'platformatic-dynamic-workspace-deploy.yml')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.github', 'workflows', 'platformatic-static-workspace-deploy.yml')), true)
})
