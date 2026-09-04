import { loadConfiguration as loadRuntimeConfiguration } from '@platformatic/runtime'
import { deepStrictEqual, equal, ok } from 'node:assert'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { isFileAccessible } from '../../lib/utils.js'
import { configurationFileIn, createTemporaryDirectory, executeCreatePlatformatic, getApplications, linkDependencies, linkWorkspacePackages, setupUserInputHandler } from './helper.js'

test('Creates a Platformatic Runtime with two Applications', async t => {
  const root = await createTemporaryDirectory(t, 'runtime')

  // The actions must match IN ORDER
  const userInputHandler = await setupUserInputHandler(t, [
    { type: 'input', question: 'Where would you like to create your project?', reply: '.' },
    { type: 'select', question: 'Which kind of application do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the application?', reply: 'application1' },
    { type: 'select', question: 'Do you want to use TypeScript?', reply: 'yes' },
    { type: 'select', question: 'Do you want to create another application?', reply: 'yes' },
    { type: 'select', question: 'Which kind of application do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the application?', reply: 'application2' },
    { type: 'select', question: 'Do you want to use TypeScript?', reply: 'yes' },
    { type: 'select', question: 'Do you want to create another application?', reply: 'no' },
    { type: 'select', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  // The actions must match IN ORDER
  await executeCreatePlatformatic(root, { pkgManager: 'pnpm', userInputHandler })

  equal(await isFileAccessible(join(root, '.gitignore')), true)
  equal(await isFileAccessible(join(root, '.env')), true)
  equal(await isFileAccessible(join(root, '.env.sample')), true)
  ok(await configurationFileIn(root))

  // using pnpm will create workspace file
  equal(await isFileAccessible(join(root, 'pnpm-workspace.yaml')), true)

  // Here check the generated applications
  const applications = await getApplications(join(root, 'applications'))
  deepStrictEqual(applications, ['application1', 'application2'])
  const env = await readFile(join(root, '.env'), 'utf-8')
  equal(env.includes('PLT_APPLICATION1_PORT=3042'), true)
  equal(env.includes('PLT_APPLICATION2_PORT=3043'), true)
  const baseApplication0Dir = join(root, 'applications', applications[0])
  ok(await configurationFileIn(baseApplication0Dir))
  equal(await isFileAccessible(join(baseApplication0Dir, 'README.md')), true)
  equal(await isFileAccessible(join(baseApplication0Dir, 'routes', 'root.ts')), true)
  equal(await isFileAccessible(join(baseApplication0Dir, 'plugins', 'example.ts')), true)
  equal(await isFileAccessible(join(baseApplication0Dir, 'plt-env.d.ts')), true)

  const baseApplication1Dir = join(root, 'applications', applications[1])
  ok(await configurationFileIn(baseApplication1Dir))
  equal(await isFileAccessible(join(baseApplication1Dir, 'README.md')), true)
  equal(await isFileAccessible(join(baseApplication1Dir, 'routes', 'root.ts')), true)
  equal(await isFileAccessible(join(baseApplication1Dir, 'plugins', 'example.ts')), true)
  equal(await isFileAccessible(join(baseApplication1Dir, 'plt-env.d.ts')), true)

  // The scaffolded project loads through the full v4 runtime pipeline: autoload discovers both
  // applications under applications/, each evaluating against the project's own environment. This is
  // what proves the wizard writes a bootable project rather than merely a plausible set of files.
  await linkWorkspacePackages(root)
  const runtimeConfig = await loadRuntimeConfiguration(join(root, await configurationFileIn(root)), null, {
    command: 'start'
  })
  deepStrictEqual(
    runtimeConfig.applications.map(entry => entry.id).sort(),
    ['application1', 'application2']
  )
})

test('Add another application to an existing application', async t => {
  const tmpDir = await createTemporaryDirectory(t, 'runtime')
  const root = join(tmpDir, 'platformatic')

  {
    const userInputHandler = await setupUserInputHandler(t, [
      { type: 'input', question: 'Where would you like to create your project?', reply: 'platformatic' },
      { type: 'select', question: 'Which kind of application do you want to create?', reply: '@platformatic/service' },
      { type: 'input', question: 'What is the name of the application?', reply: 'application1' },
      { type: 'select', question: 'Do you want to use TypeScript?', reply: 'no' },
      { type: 'select', question: 'Do you want to create another application?', reply: 'no' },
      { type: 'select', question: 'Do you want to init the git repository?', reply: 'no' }
    ])

    await executeCreatePlatformatic(tmpDir, { pkgManager: 'pnpm', userInputHandler })

    equal(await isFileAccessible(join(root, '.gitignore')), true)
    equal(await isFileAccessible(join(root, '.env')), true)
    equal(await isFileAccessible(join(root, '.env.sample')), true)
    ok(await configurationFileIn(root))

    // using pnpm will create workspace file
    equal(await isFileAccessible(join(root, 'pnpm-workspace.yaml')), true)

    // Here check the generated applications
    const applications = await getApplications(join(root, 'applications'))
    deepStrictEqual(applications, ['application1'])
    const applicationRoot = join(root, 'applications', applications[0])
    ok(await configurationFileIn(applicationRoot))
    equal(await isFileAccessible(join(applicationRoot, 'README.md')), true)
    equal(await isFileAccessible(join(applicationRoot, 'routes', 'root.js')), true)
    equal(await isFileAccessible(join(applicationRoot, 'plugins', 'example.js')), true)
    equal(await isFileAccessible(join(applicationRoot, 'plt-env.d.ts')), true)

    await linkDependencies(root, ['@platformatic/service'])
  }

  {
    // The actions must match IN ORDER
    const userInputHandler = await setupUserInputHandler(t, [
      { type: 'select', question: 'Which kind of application do you want to create?', reply: '@platformatic/service' },
      { type: 'input', question: 'What is the name of the application?', reply: 'application2' },
      { type: 'select', question: 'Do you want to use TypeScript?', reply: 'yes' },
      { type: 'select', question: 'Do you want to create another application?', reply: 'no' }
    ])

    // The actions must match IN ORDER
    await executeCreatePlatformatic(root, { pkgManager: 'pnpm', userInputHandler })

    // Here check the generated applications
    const applications = await getApplications(join(root, 'applications'))
    deepStrictEqual(applications, ['application1', 'application2'])
    const env = await readFile(join(root, '.env'), 'utf-8')
    equal(env.includes('PLT_APPLICATION1_PORT=3042'), true)
    equal(env.includes('PLT_APPLICATION2_PORT=3043'), true)
    const applicationRoot = join(root, 'applications', applications[1])
    ok(await configurationFileIn(applicationRoot))
    equal(await isFileAccessible(join(applicationRoot, 'README.md')), true)
    equal(await isFileAccessible(join(applicationRoot, 'routes', 'root.ts')), true)
    equal(await isFileAccessible(join(applicationRoot, 'plugins', 'example.ts')), true)
    equal(await isFileAccessible(join(applicationRoot, 'plt-env.d.ts')), true)
  }
})
