import { test } from 'node:test'
import { equal, notEqual } from 'node:assert'
import { executeCreatePlatformatic, keys, walk } from './helper.mjs'
import { timeout } from './timeout.mjs'
import { isFileAccessible, safeMkdir } from '../../src/utils.mjs'
import { join } from 'node:path'
import { tmpdir } from 'os'
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises'

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

test('Creates a Platformatic Service with no typescript', { timeout }, async () => {
  // The actions must match IN ORDER
  const actions = [{
    match: 'Which kind of project do you want to create?',
    do: [keys.DOWN, keys.ENTER] // Service
  }, {
    match: 'Where would you like to create your project?',
    do: [keys.ENTER]
  }, {
    // NOTE THAT HERE THE DEFAULT OPTION FOR SERVICE IS "YES"
    match: 'Do you want to use TypeScript',
    do: [keys.DOWN, keys.ENTER] // no
  }, {
    match: 'What port do you want to use?',
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

  const baseProjectDir = join(tmpDir, 'platformatic-service')
  const files = await walk(baseProjectDir)
  console.log('==> created files', files)
  equal(await isFileAccessible(join(baseProjectDir, '.gitignore')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.env')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.env.sample')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'platformatic.service.json')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'README.md')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'routes', 'root.js')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'plugins', 'example.js')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.git', 'config')), true)
})

test('Creates a Platformatic Service with typescript', { timeout }, async () => {
  // The actions must match IN ORDER
  const actions = [{
    match: 'Which kind of project do you want to create?',
    do: [keys.DOWN, keys.ENTER] // Service
  }, {
    match: 'Where would you like to create your project?',
    do: [keys.ENTER]
  }, {
    // NOTE THAT HERE THE DEFAULT OPTION FOR SERVICE IS "YES"
    match: 'Do you want to use TypeScript',
    do: [keys.ENTER] // yes
  }, {
    match: 'What port do you want to use?',
    do: [keys.ENTER]
  }, {
    match: 'Do you want to create the github action to deploy',
    do: [keys.ENTER] // no
  }, {
    match: 'Do you want to enable PR Previews in your application',
    do: [keys.ENTER] // yes
  }, {
    match: 'Do you want to init the git repository',
    do: [keys.ENTER] // no
  }]
  await executeCreatePlatformatic(tmpDir, actions, 'All done!')

  const baseProjectDir = join(tmpDir, 'platformatic-service')
  const files = await walk(baseProjectDir)
  console.log('==> created files', files)
  equal(await isFileAccessible(join(baseProjectDir, '.gitignore')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.env')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.env.sample')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'platformatic.service.json')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'README.md')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'routes', 'root.ts')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'plugins', 'example.ts')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'global.d.ts')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.github', 'workflows', 'platformatic-dynamic-workspace-deploy.yml')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.github', 'workflows', 'platformatic-static-workspace-deploy.yml')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.git', 'config')), false)
})

test('Creates a Platformatic Service in a non empty directory', { timeout }, async () => {
  const targetDirectory = join(tmpdir(), 'platformatic-service-test')
  // const targetDirectory = '/tmp/tst'
  async function generateServiceFileStructure (dir) {
    await safeMkdir(join(targetDirectory, 'plugins'))
    await safeMkdir(join(targetDirectory, 'routes'))

    await writeFile(join(dir, '.env'), 'SAMPLE_ENV=foobar\n')

    // creates 2 files. root.js will be overwritten
    await writeFile(join(targetDirectory, 'routes', 'root.js'), 'console.log(\'hello world\')')
    await writeFile(join(targetDirectory, 'routes', 'sample.js'), 'console.log(\'hello world\')')
  }
  // generate a sample file structure
  await generateServiceFileStructure(targetDirectory)

  test.after(async () => {
    await rm(targetDirectory, { recursive: true })
  })
  // The actions must match IN ORDER
  const actions = [{
    match: 'Which kind of project do you want to create?',
    do: [keys.DOWN, keys.ENTER] // Service
  }, {
    match: 'Where would you like to create your project?',
    do: [targetDirectory, keys.ENTER]
  }, {
    match: 'Confirm you want to use',
    do: [keys.ENTER] // confirm use existing directory
  }, {
    // NOTE THAT HERE THE DEFAULT OPTION FOR SERVICE IS "YES"
    match: 'Do you want to use TypeScript',
    do: [keys.DOWN, keys.ENTER] // no
  }, {
    match: 'What port do you want to use?',
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

  equal(await isFileAccessible(join(targetDirectory, '.gitignore')), true)
  equal(await isFileAccessible(join(targetDirectory, '.env')), true)
  equal(await isFileAccessible(join(targetDirectory, '.env.sample')), true)
  equal(await isFileAccessible(join(targetDirectory, 'platformatic.service.json')), true)
  equal(await isFileAccessible(join(targetDirectory, 'README.md')), true)
  equal(await isFileAccessible(join(targetDirectory, 'routes', 'root.js')), true)
  equal(await isFileAccessible(join(targetDirectory, 'routes', 'sample.js')), true)
  equal(await isFileAccessible(join(targetDirectory, 'plugins', 'example.js')), true)
  equal(await isFileAccessible(join(targetDirectory, '.git', 'config')), true)

  // check file contents
  notEqual(await readFile(join(targetDirectory, 'routes', 'root.js'), 'utf8'), 'console.log(\'hello world\')')
  equal(await readFile(join(targetDirectory, 'routes', 'sample.js'), 'utf8'), 'console.log(\'hello world\')')
})
