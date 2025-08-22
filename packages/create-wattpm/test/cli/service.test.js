import { createDirectory } from '@platformatic/foundation'
import { deepStrictEqual, equal, notEqual } from 'node:assert'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { isFileAccessible } from '../../lib/utils.js'
import {
  createTemporaryDirectory,
  executeCreatePlatformatic,
  getApplications,
  setupUserInputHandler
} from './helper.js'

test('Creates a Platformatic Application with no Typescript', async t => {
  const root = await createTemporaryDirectory(t, 'application')

  // The actions must match IN ORDER
  const userInputHandler = await setupUserInputHandler(t, [
    { type: 'input', question: 'Where would you like to create your project?', reply: 'platformatic' },
    { type: 'list', question: 'Which kind of application do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the application?', reply: 'main' },
    { type: 'list', question: 'Do you want to use TypeScript?', reply: 'no' },
    { type: 'list', question: 'Do you want to create another application?', reply: 'no' },
    { type: 'input', question: 'What port do you want to use?', reply: '3042' },
    { type: 'list', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  await executeCreatePlatformatic(root, { userInputHandler })

  const baseProjectDir = join(root, 'platformatic')
  equal(await isFileAccessible(join(baseProjectDir, '.gitignore')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.env')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.env.sample')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'platformatic.json')), true)

  // Here check the generated application
  const applications = await getApplications(join(baseProjectDir, 'applications'))
  deepStrictEqual(applications, ['main'])
  const baseApplicationDir = join(baseProjectDir, 'applications', applications[0])
  equal(await isFileAccessible(join(baseApplicationDir, 'platformatic.json')), true)
  equal(await isFileAccessible(join(baseApplicationDir, 'README.md')), true)
  equal(await isFileAccessible(join(baseApplicationDir, 'routes', 'root.js')), true)
  equal(await isFileAccessible(join(baseApplicationDir, 'plugins', 'example.js')), true)
})

test('Creates a Platformatic Application with Typescript', async t => {
  const root = await createTemporaryDirectory(t, 'application')

  // The actions must match IN ORDER
  const userInputHandler = await setupUserInputHandler(t, [
    { type: 'input', question: 'Where would you like to create your project?', reply: 'platformatic' },
    { type: 'list', question: 'Which kind of application do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the application?', reply: 'main' },
    { type: 'list', question: 'Do you want to use TypeScript?', reply: 'yes' },
    { type: 'list', question: 'Do you want to create another application?', reply: 'no' },
    { type: 'input', question: 'What port do you want to use?', reply: '3042' },
    { type: 'list', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  await executeCreatePlatformatic(root, { userInputHandler })

  const baseProjectDir = join(root, 'platformatic')
  equal(await isFileAccessible(join(baseProjectDir, '.gitignore')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.env')), true)
  equal(await isFileAccessible(join(baseProjectDir, '.env.sample')), true)
  equal(await isFileAccessible(join(baseProjectDir, 'platformatic.json')), true)

  // Here check the generated application
  const applications = await getApplications(join(baseProjectDir, 'applications'))
  equal(applications.length, 1)
  const baseApplicationDir = join(baseProjectDir, 'applications', applications[0])
  equal(await isFileAccessible(join(baseApplicationDir, 'platformatic.json')), true)
  equal(await isFileAccessible(join(baseApplicationDir, 'tsconfig.json')), true)
  equal(await isFileAccessible(join(baseApplicationDir, 'README.md')), true)
  equal(await isFileAccessible(join(baseApplicationDir, 'routes', 'root.ts')), true)
  equal(await isFileAccessible(join(baseApplicationDir, 'plugins', 'example.ts')), true)
})

test('Creates a Platformatic Application in a non empty directory', async t => {
  const root = await createTemporaryDirectory(t, 'application')

  const applicationsDir = join(root, 'applications')
  const applicationDir = join(applicationsDir, 'foo')
  await createDirectory(applicationsDir)
  await createDirectory(join(applicationDir, 'plugins'))
  await createDirectory(join(applicationDir, 'routes'))
  await writeFile(join(root, '.env'), 'SAMPLE_ENV=foobar\n')
  // creates 2 files. root.js will be overwritten
  await writeFile(join(applicationDir, 'routes', 'root.js'), "console.log('hello world')")
  await writeFile(join(applicationDir, 'routes', 'sample.js'), "console.log('hello world')")

  // The actions must match IN ORDER
  const userInputHandler = await setupUserInputHandler(t, [
    {
      type: 'list',
      question: 'This folder seems to already contain a Node.js application. Do you want to wrap into Watt?',
      reply: 'no'
    },
    { type: 'input', question: 'Where would you like to create your project?', reply: '.' },
    { type: 'list', question: 'Which kind of application do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the application?', reply: 'foo' },
    { type: 'list', question: 'Do you want to use TypeScript?', reply: 'no' },
    { type: 'list', question: 'Do you want to create another application?', reply: 'no' },
    { type: 'input', question: 'What port do you want to use?', reply: '3042' },
    { type: 'list', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  await executeCreatePlatformatic(root, { userInputHandler })

  equal(await isFileAccessible(join(root, '.gitignore')), true)
  equal(await isFileAccessible(join(root, '.env')), true)
  equal(await isFileAccessible(join(root, '.env.sample')), true)
  equal(await isFileAccessible(join(root, 'platformatic.json')), true)
  equal(await isFileAccessible(join(root, 'applications/foo/routes/root.js')), true)
  equal(await isFileAccessible(join(root, 'applications/foo/routes/sample.js')), true)
  equal(await isFileAccessible(join(root, 'applications/foo/plugins/example.js')), true)

  // check file contents
  notEqual(await readFile(join(root, 'applications/foo/routes/root.js'), 'utf8'), "console.log('hello world')")
  equal(await readFile(join(root, 'applications/foo/routes/sample.js'), 'utf8'), "console.log('hello world')")
})
