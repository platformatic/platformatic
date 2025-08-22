import { deepStrictEqual, equal } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { isFileAccessible } from '../../lib/utils.js'
import {
  createTemporaryDirectory,
  executeCreatePlatformatic,
  getApplications,
  setupUserInputHandler
} from './helper.js'

test('Creates a Platformatic DB application with no migrations', async t => {
  const root = await createTemporaryDirectory(t, 'db')

  // The actions must match IN ORDER
  const userInputHandler = await setupUserInputHandler(t, [
    { type: 'input', question: 'Where would you like to create your project?', reply: 'platformatic' },
    { type: 'list', question: 'Which kind of application do you want to create?', reply: '@platformatic/db' },
    { type: 'input', question: 'What is the name of the application?', reply: 'main' },
    { type: 'input', question: 'What is the connection string?', reply: 'sqlite://./db.sqlite' },
    { type: 'list', question: 'Do you want to create default migrations?', reply: 'no' },
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
  // This is accessible only because is a folder with a .gitkeep file only
  equal(await isFileAccessible(join(baseApplicationDir, 'migrations')), true)
  equal(await isFileAccessible(join(baseApplicationDir, 'routes', 'root.js')), true)
  equal(await isFileAccessible(join(baseApplicationDir, 'plugins', 'example.js')), true)
})
