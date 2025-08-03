import { execa } from 'execa'
import { deepStrictEqual, ok } from 'node:assert'
import { existsSync } from 'node:fs'
import { cp, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import {
  createTemporaryDirectory,
  executeCreatePlatformatic,
  setupUserInputHandler,
  startMarketplace
} from './helper.mjs'

const version = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')).version

test('Support packages without generator via importing (new application)', async t => {
  const external = await createTemporaryDirectory(t, 'external')
  const applicationPath = resolve(external, 'existing-application')
  await cp(new URL('../fixtures/existing-application', import.meta.url), applicationPath, { recursive: true })

  const root = await createTemporaryDirectory(t, 'other')
  const marketplaceHost = await startMarketplace(t)

  // The actions must match IN ORDER
  const userInputHandler = await setupUserInputHandler(t, [
    { type: 'input', question: 'Where would you like to create your project?', reply: 'platformatic' },
    { type: 'list', question: 'Which kind of service do you want to create?', reply: '@platformatic/vite' },
    { type: 'input', question: 'What is the name of the service?', reply: 'main' },
    { type: 'input', question: 'Where is your application located?', reply: applicationPath },
    { type: 'list', question: 'Do you want to import or copy your application?', reply: 'import' },
    { type: 'list', question: 'Do you want to create another service?', reply: 'no' },
    { type: 'input', question: 'What port do you want to use?', reply: '3042' },
    { type: 'list', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  await executeCreatePlatformatic(root, {
    marketplaceHost,
    userInputHandler,
    args: ['--module=@platformatic/vite']
  })

  const baseProjectDir = join(root, 'platformatic')

  // Verify that a platformatic.json file was created
  deepStrictEqual(JSON.parse(await readFile(resolve(applicationPath, 'platformatic.json'), 'utf8')), {
    $schema: `https://schemas.platformatic.dev/@platformatic/vite/${version}.json`
  })

  // Verify that the package.json file was updated with the new dependency
  const packageJson = JSON.parse(await readFile(resolve(applicationPath, 'package.json'), 'utf8'))

  deepStrictEqual(packageJson.dependencies['@platformatic/vite'], `^${version}`)
  ok(typeof packageJson.devDependencies['@platformatic/vite'], 'undefined')

  // Verify that the runtime configuration has an explicit entry for the vite service
  const runtimeConfig = JSON.parse(await readFile(resolve(baseProjectDir, 'platformatic.json'), 'utf8'))
  deepStrictEqual(runtimeConfig.services, [
    {
      id: 'main',
      path: '{PLT_SERVICE_MAIN_PATH}'
    }
  ])

  // Verify that the .env file was created with the correct path
  const envFile = await readFile(resolve(baseProjectDir, '.env'), 'utf-8')
  ok(envFile.includes(`PLT_SERVICE_MAIN_PATH=${applicationPath}`))
})

test('Support packages without generator via importing (existing applications)', async t => {
  const external = await createTemporaryDirectory(t, 'external')
  const applicationPath = resolve(external, 'existing-application')
  await cp(new URL('../fixtures/existing-application', import.meta.url), applicationPath, { recursive: true })

  // Initialize git
  await execa('git', ['init', '.'], { cwd: applicationPath })
  await execa('git', ['remote', 'add', 'origin', 'git@github.com:hello/world.git'], { cwd: applicationPath })

  const root = await createTemporaryDirectory(t, 'other')
  const marketplaceHost = await startMarketplace(t)
  const baseProjectDir = join(root, 'platformatic')

  // The actions must match IN ORDER
  const userInputHandler1 = await setupUserInputHandler(t, [
    { type: 'input', question: 'Where would you like to create your project?', reply: 'platformatic' },
    { type: 'list', question: 'Which kind of service do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the service?', reply: 'main' },
    { type: 'list', question: 'Do you want to use TypeScript?', reply: 'no' },
    { type: 'list', question: 'Do you want to create another service?', reply: 'no' },
    { type: 'input', question: 'What port do you want to use?', reply: '3042' },
    { type: 'list', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  const userInputHandler2 = await setupUserInputHandler(t, [
    { type: 'list', question: 'Which kind of service do you want to create?', reply: '@platformatic/vite' },
    { type: 'input', question: 'What is the name of the service?', reply: 'alternate' },
    { type: 'input', question: 'Where is your application located?', reply: applicationPath },
    { type: 'list', question: 'Do you want to import or copy your application?', reply: 'import' },
    { type: 'list', question: 'Do you want to create another service?', reply: 'no' },
    { type: 'list', question: 'Which service should be exposed?', reply: 'main' }
  ])

  await executeCreatePlatformatic(root, {
    marketplaceHost,
    userInputHandler: userInputHandler1
  })

  let runtimeConfig = JSON.parse(await readFile(resolve(join(baseProjectDir, 'platformatic.json')), 'utf8'))
  const originalEnvFile = await readFile(resolve(baseProjectDir, '.env'), 'utf-8')
  runtimeConfig.web = [{ id: 'main', path: 'services/main' }]
  runtimeConfig.startTimeout = 12345
  await writeFile(resolve(join(baseProjectDir, 'platformatic.json')), JSON.stringify(runtimeConfig, null, 2))

  await executeCreatePlatformatic(root, {
    marketplaceHost,
    userInputHandler: userInputHandler2,
    args: ['--module=@platformatic/vite']
  })

  // Verify that a platformatic.json file was created
  deepStrictEqual(JSON.parse(await readFile(resolve(applicationPath, 'platformatic.json'), 'utf8')), {
    $schema: `https://schemas.platformatic.dev/@platformatic/vite/${version}.json`
  })

  // Verify that the package.json file was updated with the new dependency
  const packageJson = JSON.parse(await readFile(resolve(applicationPath, 'package.json'), 'utf8'))

  deepStrictEqual(packageJson.dependencies['@platformatic/vite'], `^${version}`)
  ok(typeof packageJson.devDependencies['@platformatic/vite'], 'undefined')

  // Verify that the runtime configuration has an explicit entry for the vite service but with other entries untouched
  runtimeConfig = JSON.parse(await readFile(resolve(baseProjectDir, 'platformatic.json'), 'utf8'))

  deepStrictEqual(runtimeConfig.web, [
    {
      id: 'main',
      path: 'services/main'
    },
    {
      id: 'alternate',
      path: '{PLT_SERVICE_ALTERNATE_PATH}',
      url: 'git@github.com:hello/world.git'
    }
  ])
  deepStrictEqual(runtimeConfig.startTimeout, 12345)

  ok(typeof runtimeConfig.services, 'undefined')

  // Verify that the .env file was updated
  const envFile = await readFile(resolve(baseProjectDir, '.env'), 'utf-8')

  deepStrictEqual(envFile, `${originalEnvFile}\nPLT_SERVICE_ALTERNATE_PATH=${applicationPath}`)
})

test('Support packages without generator via copy (new application)', async t => {
  const external = await createTemporaryDirectory(t, 'external')
  const sourcePath = resolve(external, 'existing-application')
  await cp(new URL('../fixtures/existing-application', import.meta.url), sourcePath, { recursive: true })

  const originalPackageJson = await readFile(resolve(sourcePath, 'package.json'), 'utf8')

  const root = await createTemporaryDirectory(t, 'other')
  const marketplaceHost = await startMarketplace(t)

  // The actions must match IN ORDER
  const userInputHandler = await setupUserInputHandler(t, [
    { type: 'input', question: 'Where would you like to create your project?', reply: 'platformatic' },
    { type: 'list', question: 'Which kind of service do you want to create?', reply: '@platformatic/vite' },
    { type: 'input', question: 'What is the name of the service?', reply: 'main' },
    { type: 'input', question: 'Where is your application located?', reply: sourcePath },
    { type: 'list', question: 'Do you want to import or copy your application?', reply: 'copy' },
    { type: 'list', question: 'Do you want to create another service?', reply: 'no' },
    { type: 'input', question: 'What port do you want to use?', reply: '3042' },
    { type: 'list', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  await executeCreatePlatformatic(root, {
    marketplaceHost,
    userInputHandler,
    args: ['--module=@platformatic/vite']
  })

  const baseProjectDir = join(root, 'platformatic')
  const serviceDir = join(baseProjectDir, 'services', 'main')

  // Verify that a platformatic.json file was created and not in the original path
  ok(!existsSync(resolve(sourcePath, 'platformatic.json')))
  deepStrictEqual(JSON.parse(await readFile(resolve(serviceDir, 'platformatic.json'), 'utf8')), {
    $schema: `https://schemas.platformatic.dev/@platformatic/vite/${version}.json`
  })

  // Verify that the package.json file was updated with the new dependency and that the original package.json was not modified
  const packageJson = JSON.parse(await readFile(resolve(serviceDir, 'package.json'), 'utf8'))
  deepStrictEqual(packageJson.dependencies['@platformatic/vite'], `^${version}`)
  ok(typeof packageJson.devDependencies['@platformatic/vite'], 'undefined')
  deepStrictEqual(await readFile(resolve(sourcePath, 'package.json'), 'utf8'), originalPackageJson)

  // Verify that the runtime configuration has no explicit entry as everything is in the services directory
  const runtimeConfig = JSON.parse(await readFile(resolve(baseProjectDir, 'platformatic.json'), 'utf8'))
  ok(typeof runtimeConfig.services, 'undefined')
  ok(typeof runtimeConfig.web, 'undefined')

  // Verify that the original node_modules directory was not copied
  ok(!existsSync(resolve(serviceDir, 'node_modules/fake/fake.js')))
})

test('Support packages without generator via copy (existing applications)', async t => {
  const external = await createTemporaryDirectory(t, 'external')
  const sourcePath = resolve(external, 'existing-application')
  await cp(new URL('../fixtures/existing-application', import.meta.url), sourcePath, { recursive: true })

  const originalPackageJson = await readFile(resolve(sourcePath, 'package.json'), 'utf8')

  const root = await createTemporaryDirectory(t, 'other')
  const marketplaceHost = await startMarketplace(t)
  const baseProjectDir = join(root, 'platformatic')

  // The actions must match IN ORDER
  const userInputHandler1 = await setupUserInputHandler(t, [
    { type: 'input', question: 'Where would you like to create your project?', reply: 'platformatic' },
    { type: 'list', question: 'Which kind of service do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the service?', reply: 'main' },
    { type: 'list', question: 'Do you want to use TypeScript?', reply: 'no' },
    { type: 'list', question: 'Do you want to create another service?', reply: 'no' },
    { type: 'input', question: 'What port do you want to use?', reply: '3042' },
    { type: 'list', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  const userInputHandler2 = await setupUserInputHandler(t, [
    { type: 'list', question: 'Which kind of service do you want to create?', reply: '@platformatic/vite' },
    { type: 'input', question: 'What is the name of the service?', reply: 'alternate' },
    { type: 'input', question: 'Where is your application located?', reply: sourcePath },
    { type: 'list', question: 'Do you want to import or copy your application?', reply: 'copy' },
    { type: 'list', question: 'Do you want to create another service?', reply: 'no' },
    { type: 'list', question: 'Which service should be exposed?', reply: 'main' }
  ])

  await executeCreatePlatformatic(root, {
    marketplaceHost,
    userInputHandler: userInputHandler1
  })

  let runtimeConfig = JSON.parse(await readFile(resolve(join(baseProjectDir, 'platformatic.json')), 'utf8'))
  runtimeConfig.web = [{ id: 'main', path: 'services/main' }]
  runtimeConfig.startTimeout = 12345
  await writeFile(resolve(join(baseProjectDir, 'platformatic.json')), JSON.stringify(runtimeConfig, null, 2))

  await executeCreatePlatformatic(root, {
    marketplaceHost,
    userInputHandler: userInputHandler2,
    args: ['--module=@platformatic/vite']
  })

  const serviceDir = join(baseProjectDir, 'services', 'alternate')

  // Verify that a platformatic.json file was created and not in the original path
  ok(!existsSync(resolve(sourcePath, 'platformatic.json')))
  deepStrictEqual(JSON.parse(await readFile(resolve(serviceDir, 'platformatic.json'), 'utf8')), {
    $schema: `https://schemas.platformatic.dev/@platformatic/vite/${version}.json`
  })

  // Verify that the package.json file was updated with the new dependency and that the original package.json was not modified
  const packageJson = JSON.parse(await readFile(resolve(serviceDir, 'package.json'), 'utf8'))
  deepStrictEqual(packageJson.dependencies['@platformatic/vite'], `^${version}`)
  ok(typeof packageJson.devDependencies['@platformatic/vite'], 'undefined')
  deepStrictEqual(await readFile(resolve(sourcePath, 'package.json'), 'utf8'), originalPackageJson)

  // Verify that a platformatic.json file was created and not in the original path
  ok(!existsSync(resolve(sourcePath, 'platformatic.json')))
  deepStrictEqual(JSON.parse(await readFile(resolve(serviceDir, 'platformatic.json'), 'utf8')), {
    $schema: `https://schemas.platformatic.dev/@platformatic/vite/${version}.json`
  })

  // Verify that the runtime configuration has no explicit entry as everything is in the services directory
  runtimeConfig = JSON.parse(await readFile(resolve(baseProjectDir, 'platformatic.json'), 'utf8'))
  ok(typeof runtimeConfig.services, 'undefined')
  ok(typeof runtimeConfig.web, 'undefined')
})
