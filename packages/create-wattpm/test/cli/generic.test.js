import { execa } from 'execa'
import { deepStrictEqual, ok } from 'node:assert'
import { existsSync } from 'node:fs'
import { cp, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { createTemporaryDirectory, executeCreatePlatformatic, setupUserInputHandler } from './helper.js'

const version = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')).version

test('Support packages without generator via importing (new application)', async t => {
  const external = await createTemporaryDirectory(t, 'external')
  const applicationPath = resolve(external, 'existing-application')
  await cp(new URL('../fixtures/existing-application', import.meta.url), applicationPath, { recursive: true })

  const root = await createTemporaryDirectory(t, 'other')

  // The actions must match IN ORDER
  const userInputHandler = await setupUserInputHandler(t, [
    { type: 'input', question: 'Where would you like to create your project?', reply: 'platformatic' },
    { type: 'list', question: 'Which kind of application do you want to create?', reply: '@platformatic/vite' },
    { type: 'input', question: 'What is the name of the application?', reply: 'main' },
    { type: 'input', question: 'Where is your application located?', reply: applicationPath },
    { type: 'list', question: 'Do you want to import or copy your application?', reply: 'import' },
    { type: 'list', question: 'Do you want to create another application?', reply: 'no' },
    { type: 'input', question: 'What port do you want to use?', reply: '3042' },
    { type: 'list', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  await executeCreatePlatformatic(root, {
    userInputHandler,
    args: ['--module=@platformatic/vite']
  })

  const baseProjectDir = join(root, 'platformatic')

  // Verify that a watt.json file was created
  deepStrictEqual(JSON.parse(await readFile(resolve(applicationPath, 'watt.json'), 'utf8')), {
    $schema: `https://schemas.platformatic.dev/@platformatic/vite/${version}.json`
  })

  // Verify that the package.json file was updated with the new dependency
  const packageJson = JSON.parse(await readFile(resolve(applicationPath, 'package.json'), 'utf8'))

  deepStrictEqual(packageJson.dependencies['@platformatic/vite'], `^${version}`)
  ok(typeof packageJson.devDependencies['@platformatic/vite'], 'undefined')

  // Verify that the runtime configuration has an explicit entry for the vite application
  const runtimeConfig = JSON.parse(await readFile(resolve(baseProjectDir, 'watt.json'), 'utf8'))
  deepStrictEqual(runtimeConfig.web, [
    {
      id: 'main',
      path: '{PLT_APPLICATION_MAIN_PATH}'
    }
  ])

  // Verify that the .env file was created with the correct path
  const envFile = await readFile(resolve(baseProjectDir, '.env'), 'utf-8')
  ok(envFile.includes(`PLT_APPLICATION_MAIN_PATH=${applicationPath}`))
})

test('Support packages without generator via importing (existing applications)', async t => {
  const external = await createTemporaryDirectory(t, 'external')
  const applicationPath = resolve(external, 'existing-application')
  await cp(new URL('../fixtures/existing-application', import.meta.url), applicationPath, { recursive: true })

  // Initialize git
  await execa('git', ['init', '.'], { cwd: applicationPath })
  await execa('git', ['remote', 'add', 'origin', 'git@github.com:hello/world.git'], { cwd: applicationPath })

  const root = await createTemporaryDirectory(t, 'other')
  const baseProjectDir = join(root, 'platformatic')

  // The actions must match IN ORDER
  const userInputHandler1 = await setupUserInputHandler(t, [
    { type: 'input', question: 'Where would you like to create your project?', reply: 'platformatic' },
    { type: 'list', question: 'Which kind of application do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the application?', reply: 'main' },
    { type: 'list', question: 'Do you want to use TypeScript?', reply: 'no' },
    { type: 'list', question: 'Do you want to create another application?', reply: 'no' },
    { type: 'input', question: 'What port do you want to use?', reply: '3042' },
    { type: 'list', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  const userInputHandler2 = await setupUserInputHandler(t, [
    { type: 'list', question: 'Which kind of application do you want to create?', reply: '@platformatic/vite' },
    { type: 'input', question: 'What is the name of the application?', reply: 'alternate' },
    { type: 'input', question: 'Where is your application located?', reply: applicationPath },
    { type: 'list', question: 'Do you want to import or copy your application?', reply: 'import' },
    { type: 'list', question: 'Do you want to create another application?', reply: 'no' },
    { type: 'list', question: 'Which application should be exposed?', reply: 'main' }
  ])

  await executeCreatePlatformatic(root, {
    userInputHandler: userInputHandler1
  })

  let runtimeConfig = JSON.parse(await readFile(resolve(join(baseProjectDir, 'watt.json')), 'utf8'))
  const originalEnvFile = await readFile(resolve(baseProjectDir, '.env'), 'utf-8')
  runtimeConfig.web = [{ id: 'main', path: 'services/main' }]
  runtimeConfig.startTimeout = 12345
  await writeFile(resolve(join(baseProjectDir, 'watt.json')), JSON.stringify(runtimeConfig, null, 2))

  await executeCreatePlatformatic(root, {
    userInputHandler: userInputHandler2,
    args: ['--module=@platformatic/vite']
  })

  // Verify that a watt.json file was created
  deepStrictEqual(JSON.parse(await readFile(resolve(applicationPath, 'watt.json'), 'utf8')), {
    $schema: `https://schemas.platformatic.dev/@platformatic/vite/${version}.json`
  })

  // Verify that the package.json file was updated with the new dependency
  const packageJson = JSON.parse(await readFile(resolve(applicationPath, 'package.json'), 'utf8'))

  deepStrictEqual(packageJson.dependencies['@platformatic/vite'], `^${version}`)
  ok(typeof packageJson.devDependencies['@platformatic/vite'], 'undefined')

  // Verify that the runtime configuration has an explicit entry for the vite application but with other entries untouched
  runtimeConfig = JSON.parse(await readFile(resolve(baseProjectDir, 'watt.json'), 'utf8'))

  deepStrictEqual(runtimeConfig.web, [
    {
      id: 'main',
      path: 'services/main'
    },
    {
      id: 'alternate',
      path: '{PLT_APPLICATION_ALTERNATE_PATH}',
      url: 'git@github.com:hello/world.git'
    }
  ])
  deepStrictEqual(runtimeConfig.startTimeout, 12345)

  ok(typeof runtimeConfig.applications, 'undefined')

  // Verify that the .env file was updated
  const envFile = await readFile(resolve(baseProjectDir, '.env'), 'utf-8')

  // Check that all original env variables are still present
  const originalLines = originalEnvFile.trim().split('\n').filter(line => line.trim())
  const envLines = envFile.trim().split('\n').filter(line => line.trim())

  for (const line of originalLines) {
    ok(envLines.includes(line), `Expected env file to contain: ${line}`)
  }

  // Check that the new variable was added
  ok(envFile.includes(`PLT_APPLICATION_ALTERNATE_PATH=${applicationPath}`), 'Expected env file to contain PLT_APPLICATION_ALTERNATE_PATH')
})

test('Support packages without generator via copy (new application)', async t => {
  const external = await createTemporaryDirectory(t, 'external')
  const sourcePath = resolve(external, 'existing-application')
  await cp(new URL('../fixtures/existing-application', import.meta.url), sourcePath, { recursive: true })

  const originalPackageJson = await readFile(resolve(sourcePath, 'package.json'), 'utf8')

  const root = await createTemporaryDirectory(t, 'other')

  // The actions must match IN ORDER
  const userInputHandler = await setupUserInputHandler(t, [
    { type: 'input', question: 'Where would you like to create your project?', reply: 'platformatic' },
    { type: 'list', question: 'Which kind of application do you want to create?', reply: '@platformatic/vite' },
    { type: 'input', question: 'What is the name of the application?', reply: 'main' },
    { type: 'input', question: 'Where is your application located?', reply: sourcePath },
    { type: 'list', question: 'Do you want to import or copy your application?', reply: 'copy' },
    { type: 'list', question: 'Do you want to create another application?', reply: 'no' },
    { type: 'input', question: 'What port do you want to use?', reply: '3042' },
    { type: 'list', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  await executeCreatePlatformatic(root, {
    userInputHandler,
    args: ['--module=@platformatic/vite']
  })

  const baseProjectDir = join(root, 'platformatic')
  const applicationDir = join(baseProjectDir, 'web', 'main')

  // Verify that a watt.json file was created and not in the original path
  ok(!existsSync(resolve(sourcePath, 'watt.json')))
  deepStrictEqual(JSON.parse(await readFile(resolve(applicationDir, 'watt.json'), 'utf8')), {
    $schema: `https://schemas.platformatic.dev/@platformatic/vite/${version}.json`
  })

  // Verify that the package.json file was updated with the new dependency and that the original package.json was not modified
  const packageJson = JSON.parse(await readFile(resolve(applicationDir, 'package.json'), 'utf8'))
  deepStrictEqual(packageJson.dependencies['@platformatic/vite'], `^${version}`)
  ok(typeof packageJson.devDependencies['@platformatic/vite'], 'undefined')
  deepStrictEqual(await readFile(resolve(sourcePath, 'package.json'), 'utf8'), originalPackageJson)

  // Verify that the runtime configuration has no explicit entry as everything is in the applications directory
  const runtimeConfig = JSON.parse(await readFile(resolve(baseProjectDir, 'watt.json'), 'utf8'))
  ok(typeof runtimeConfig.applications, 'undefined')
  ok(typeof runtimeConfig.web, 'undefined')

  // Verify that the original node_modules directory was not copied
  ok(!existsSync(resolve(applicationDir, 'node_modules/fake/fake.js')))
})

test('Support packages without generator via copy (existing applications)', async t => {
  const external = await createTemporaryDirectory(t, 'external')
  const sourcePath = resolve(external, 'existing-application')
  await cp(new URL('../fixtures/existing-application', import.meta.url), sourcePath, { recursive: true })

  const originalPackageJson = await readFile(resolve(sourcePath, 'package.json'), 'utf8')

  const root = await createTemporaryDirectory(t, 'other')
  const baseProjectDir = join(root, 'platformatic')

  // The actions must match IN ORDER
  const userInputHandler1 = await setupUserInputHandler(t, [
    { type: 'input', question: 'Where would you like to create your project?', reply: 'platformatic' },
    { type: 'list', question: 'Which kind of application do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the application?', reply: 'main' },
    { type: 'list', question: 'Do you want to use TypeScript?', reply: 'no' },
    { type: 'list', question: 'Do you want to create another application?', reply: 'no' },
    { type: 'input', question: 'What port do you want to use?', reply: '3042' },
    { type: 'list', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  const userInputHandler2 = await setupUserInputHandler(t, [
    { type: 'list', question: 'Which kind of application do you want to create?', reply: '@platformatic/vite' },
    { type: 'input', question: 'What is the name of the application?', reply: 'alternate' },
    { type: 'input', question: 'Where is your application located?', reply: sourcePath },
    { type: 'list', question: 'Do you want to import or copy your application?', reply: 'copy' },
    { type: 'list', question: 'Do you want to create another application?', reply: 'no' },
    { type: 'list', question: 'Which application should be exposed?', reply: 'main' }
  ])

  await executeCreatePlatformatic(root, {
    userInputHandler: userInputHandler1
  })

  let runtimeConfig = JSON.parse(await readFile(resolve(join(baseProjectDir, 'watt.json')), 'utf8'))
  runtimeConfig.web = [{ id: 'main', path: 'services/main' }]
  runtimeConfig.startTimeout = 12345
  await writeFile(resolve(join(baseProjectDir, 'watt.json')), JSON.stringify(runtimeConfig, null, 2))

  await executeCreatePlatformatic(root, {
    userInputHandler: userInputHandler2,
    args: ['--module=@platformatic/vite']
  })

  const applicationDir = join(baseProjectDir, 'web', 'alternate')

  // Verify that a watt.json file was created and not in the original path
  ok(!existsSync(resolve(sourcePath, 'watt.json')))
  deepStrictEqual(JSON.parse(await readFile(resolve(applicationDir, 'watt.json'), 'utf8')), {
    $schema: `https://schemas.platformatic.dev/@platformatic/vite/${version}.json`
  })

  // Verify that the package.json file was updated with the new dependency and that the original package.json was not modified
  const packageJson = JSON.parse(await readFile(resolve(applicationDir, 'package.json'), 'utf8'))
  deepStrictEqual(packageJson.dependencies['@platformatic/vite'], `^${version}`)
  ok(typeof packageJson.devDependencies['@platformatic/vite'], 'undefined')
  deepStrictEqual(await readFile(resolve(sourcePath, 'package.json'), 'utf8'), originalPackageJson)

  // Verify that a watt.json file was created and not in the original path
  ok(!existsSync(resolve(sourcePath, 'watt.json')))
  deepStrictEqual(JSON.parse(await readFile(resolve(applicationDir, 'watt.json'), 'utf8')), {
    $schema: `https://schemas.platformatic.dev/@platformatic/vite/${version}.json`
  })

  // Verify that the runtime configuration has no explicit entry as everything is in the applications directory
  runtimeConfig = JSON.parse(await readFile(resolve(baseProjectDir, 'watt.json'), 'utf8'))
  ok(typeof runtimeConfig.applications, 'undefined')
  ok(typeof runtimeConfig.web, 'undefined')
})
