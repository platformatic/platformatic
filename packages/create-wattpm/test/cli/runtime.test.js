import { deepStrictEqual, equal } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { isFileAccessible } from '../../lib/utils.js'
import {
  createTemporaryDirectory,
  executeCreatePlatformatic,
  getApplications,
  linkDependencies,
  setupUserInputHandler
} from './helper.js'

test('Creates a Platformatic Runtime with two Applications', async t => {
  const root = await createTemporaryDirectory(t, 'runtime')

  // The actions must match IN ORDER
  const userInputHandler = await setupUserInputHandler(t, [
    { type: 'input', question: 'Where would you like to create your project?', reply: '.' },
    { type: 'list', question: 'Which kind of application do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the application?', reply: 'application1' },
    { type: 'list', question: 'Do you want to use TypeScript?', reply: 'yes' },
    { type: 'list', question: 'Do you want to create another application?', reply: 'yes' },
    { type: 'list', question: 'Which kind of application do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the application?', reply: 'application2' },
    { type: 'list', question: 'Do you want to use TypeScript?', reply: 'yes' },
    { type: 'list', question: 'Do you want to create another application?', reply: 'no' },
    { type: 'list', question: 'Which application should be exposed?', reply: 'application1' },
    { type: 'input', question: 'What port do you want to use?', reply: '3042' },
    { type: 'list', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  // The actions must match IN ORDER
  await executeCreatePlatformatic(root, { pkgManager: 'pnpm', userInputHandler })

  equal(await isFileAccessible(join(root, '.gitignore')), true)
  equal(await isFileAccessible(join(root, '.env')), true)
  equal(await isFileAccessible(join(root, '.env.sample')), true)
  equal(await isFileAccessible(join(root, 'platformatic.json')), true)

  // using pnpm will create workspace file
  equal(await isFileAccessible(join(root, 'pnpm-workspace.yaml')), true)

  // Here check the generated applications
  const applications = await getApplications(join(root, 'applications'))
  deepStrictEqual(applications, ['application1', 'application2'])
  const baseApplication0Dir = join(root, 'applications', applications[0])
  equal(await isFileAccessible(join(baseApplication0Dir, 'platformatic.json')), true)
  equal(await isFileAccessible(join(baseApplication0Dir, 'README.md')), true)
  equal(await isFileAccessible(join(baseApplication0Dir, 'routes', 'root.ts')), true)
  equal(await isFileAccessible(join(baseApplication0Dir, 'plugins', 'example.ts')), true)
  equal(await isFileAccessible(join(baseApplication0Dir, 'plt-env.d.ts')), true)

  const baseApplication1Dir = join(root, 'applications', applications[1])
  equal(await isFileAccessible(join(baseApplication1Dir, 'platformatic.json')), true)
  equal(await isFileAccessible(join(baseApplication1Dir, 'README.md')), true)
  equal(await isFileAccessible(join(baseApplication1Dir, 'routes', 'root.ts')), true)
  equal(await isFileAccessible(join(baseApplication1Dir, 'plugins', 'example.ts')), true)
  equal(await isFileAccessible(join(baseApplication1Dir, 'plt-env.d.ts')), true)
})

test('Add another application to an existing application', async t => {
  const tmpDir = await createTemporaryDirectory(t, 'runtime')
  const root = join(tmpDir, 'platformatic')

  {
    const userInputHandler = await setupUserInputHandler(t, [
      { type: 'input', question: 'Where would you like to create your project?', reply: 'platformatic' },
      { type: 'list', question: 'Which kind of application do you want to create?', reply: '@platformatic/service' },
      { type: 'input', question: 'What is the name of the application?', reply: 'application1' },
      { type: 'list', question: 'Do you want to use TypeScript?', reply: 'no' },
      { type: 'list', question: 'Do you want to create another application?', reply: 'no' },
      { type: 'input', question: 'What port do you want to use?', reply: '3042' },
      { type: 'list', question: 'Do you want to init the git repository?', reply: 'no' }
    ])

    await executeCreatePlatformatic(tmpDir, { pkgManager: 'pnpm', userInputHandler })

    equal(await isFileAccessible(join(root, '.gitignore')), true)
    equal(await isFileAccessible(join(root, '.env')), true)
    equal(await isFileAccessible(join(root, '.env.sample')), true)
    equal(await isFileAccessible(join(root, 'platformatic.json')), true)

    // using pnpm will create workspace file
    equal(await isFileAccessible(join(root, 'pnpm-workspace.yaml')), true)

    // Here check the generated applications
    const applications = await getApplications(join(root, 'applications'))
    deepStrictEqual(applications, ['application1'])
    const applicationRoot = join(root, 'applications', applications[0])
    equal(await isFileAccessible(join(applicationRoot, 'platformatic.json')), true)
    equal(await isFileAccessible(join(applicationRoot, 'README.md')), true)
    equal(await isFileAccessible(join(applicationRoot, 'routes', 'root.js')), true)
    equal(await isFileAccessible(join(applicationRoot, 'plugins', 'example.js')), true)
    equal(await isFileAccessible(join(applicationRoot, 'plt-env.d.ts')), true)

    await linkDependencies(root, ['@platformatic/service'])
  }

  {
    // The actions must match IN ORDER
    const userInputHandler = await setupUserInputHandler(t, [
      { type: 'list', question: 'Which kind of application do you want to create?', reply: '@platformatic/service' },
      { type: 'input', question: 'What is the name of the application?', reply: 'application2' },
      { type: 'list', question: 'Do you want to use TypeScript?', reply: 'yes' },
      { type: 'list', question: 'Do you want to create another application?', reply: 'no' },
      { type: 'list', question: 'Which application should be exposed?', reply: 'application1' }
    ])

    // The actions must match IN ORDER
    await executeCreatePlatformatic(root, { pkgManager: 'pnpm', userInputHandler })

    // Here check the generated applications
    const applications = await getApplications(join(root, 'applications'))
    deepStrictEqual(applications, ['application1', 'application2'])
    const applicationRoot = join(root, 'applications', applications[1])
    equal(await isFileAccessible(join(applicationRoot, 'platformatic.json')), true)
    equal(await isFileAccessible(join(applicationRoot, 'README.md')), true)
    equal(await isFileAccessible(join(applicationRoot, 'routes', 'root.ts')), true)
    equal(await isFileAccessible(join(applicationRoot, 'plugins', 'example.ts')), true)
    equal(await isFileAccessible(join(applicationRoot, 'plt-env.d.ts')), true)
  }
})
