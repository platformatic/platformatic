import { test, beforeEach, afterEach } from 'tap'
import { executeCreatePlatformatic, keys } from './helper.mjs'
import { mkdtempSync, rmSync } from 'fs'
import { isFileAccessible } from '../../src/utils.mjs'
import { join } from 'node:path'
import { tmpdir } from 'os'

let tmpDir
beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

test('Creates a Platformatic DB service with no migrations and no plugin', async ({ equal, same, match, teardown }) => {
  console.log('Creating Platformatic in ', tmpDir)
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
    match: 'Do you want to run npm install?',
    do: [keys.DOWN, keys.ENTER]
  }, {
    match: 'Do you want to create default migrations',
    do: [keys.DOWN, keys.ENTER]
  }, {
    match: 'Do you want to create a plugin',
    do: [keys.DOWN, keys.ENTER]
  }, {
    // NOTE THAT HERE THE DEFAULT OPTION IS "NO", so just sending ENTER we won't have TS
    match: 'Do you want to use TypeScript',
    do: [keys.ENTER]
  }, {
    match: 'Do you want to create the github action to deploy',
    do: [keys.DOWN, keys.ENTER]
  }, {
    match: 'Do you want to enable PR Previews in your application',
    do: [keys.DOWN, keys.ENTER]
  }]
  await executeCreatePlatformatic(tmpDir, actions, 'All done!')

  const baseProjectDir = join(tmpDir, 'platformatic-db')
  equal(await isFileAccessible(join(baseProjectDir, '.gitignore')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.env')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.env.sample')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'platformatic.db.json')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'README.md')), true)
})
