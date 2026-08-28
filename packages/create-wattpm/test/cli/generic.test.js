import { execa } from 'execa'
import { deepStrictEqual, equal, ok } from 'node:assert'
import { existsSync } from 'node:fs'
import { cp, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { configurationFileIn, createTemporaryDirectory, executeCreatePlatformatic, readConfiguration, setupUserInputHandler } from './helper.js'

const version = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')).version

test('Support packages without generator via importing (new application)', async t => {
  const external = await createTemporaryDirectory(t, 'external')
  const applicationPath = resolve(external, 'existing-application')
  await cp(new URL('../fixtures/existing-application', import.meta.url), applicationPath, { recursive: true })

  const root = await createTemporaryDirectory(t, 'other')

  // The actions must match IN ORDER
  const userInputHandler = await setupUserInputHandler(t, [
    { type: 'input', question: 'Where would you like to create your project?', reply: 'platformatic' },
    { type: 'select', question: 'Which kind of application do you want to create?', reply: '@platformatic/vite' },
    { type: 'input', question: 'What is the name of the application?', reply: 'main' },
    { type: 'input', question: 'Where is your application located?', reply: applicationPath },
    { type: 'select', question: 'Do you want to import or copy your application?', reply: 'import' },
    { type: 'select', question: 'Do you want to create another application?', reply: 'no' },
    { type: 'select', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  await executeCreatePlatformatic(root, {
    userInputHandler,
    args: ['--module=@platformatic/vite']
  })

  const baseProjectDir = join(root, 'platformatic')

  /*
    Asserted as source rather than evaluated: the file imports the capability, and this run installs
    nothing -- which is the state an import leaves a project in until the install happens.
  */
  const applicationConfig = await readFile(resolve(applicationPath, 'watt.config.mjs'), 'utf8')
  equal(applicationConfig, "import { vite } from '@platformatic/vite'\n\nexport default vite({})\n")

  // Verify that the package.json file was updated with the new dependency
  const packageJson = JSON.parse(await readFile(resolve(applicationPath, 'package.json'), 'utf8'))

  deepStrictEqual(packageJson.dependencies['@platformatic/vite'], `^${version}`)
  ok(typeof packageJson.devDependencies['@platformatic/vite'], 'undefined')

  /*
    Asserted as source: an imported application carries a `url`, which makes it something to fetch
    rather than something the topology already has, so it does not appear among the evaluated
    applications until `wattpm resolve` has run.
  */
  const runtimeConfigSource = await readFile(resolve(baseProjectDir, 'watt.config.mjs'), 'utf8')
  ok(runtimeConfigSource.includes("id: 'main'"), runtimeConfigSource)
  ok(runtimeConfigSource.includes('path: process.env.PLT_APPLICATION_MAIN_PATH'), runtimeConfigSource)

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
    { type: 'select', question: 'Which kind of application do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the application?', reply: 'main' },
    { type: 'select', question: 'Do you want to use TypeScript?', reply: 'no' },
    { type: 'select', question: 'Do you want to create another application?', reply: 'no' },
    { type: 'select', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  const userInputHandler2 = await setupUserInputHandler(t, [
    { type: 'select', question: 'Which kind of application do you want to create?', reply: '@platformatic/vite' },
    { type: 'input', question: 'What is the name of the application?', reply: 'alternate' },
    { type: 'input', question: 'Where is your application located?', reply: applicationPath },
    { type: 'select', question: 'Do you want to import or copy your application?', reply: 'import' },
    { type: 'select', question: 'Do you want to create another application?', reply: 'no' }
  ])

  await executeCreatePlatformatic(root, {
    userInputHandler: userInputHandler1
  })

  let runtimeConfig = await readConfiguration(join(baseProjectDir, 'watt.config.mjs'), baseProjectDir)
  const originalEnvFile = await readFile(resolve(baseProjectDir, '.env'), 'utf-8')
  runtimeConfig.web = [{ id: 'main', path: 'services/main' }]
  runtimeConfig.startTimeout = 12345
  // Written back as the module it is. The plain object form is a valid v4 root, which is what a
  // test editing a configuration wants: no imports to resolve.
  await writeFile(
    resolve(join(baseProjectDir, 'watt.config.mjs')),
    `export default ${JSON.stringify(runtimeConfig, null, 2)}\n`
  )

  await executeCreatePlatformatic(root, {
    userInputHandler: userInputHandler2,
    args: ['--module=@platformatic/vite']
  })

  /*
    Asserted as source rather than evaluated: the file imports the capability, and this run installs
    nothing -- which is the state an import leaves a project in until the install happens.
  */
  const applicationConfig = await readFile(resolve(applicationPath, 'watt.config.mjs'), 'utf8')
  equal(applicationConfig, "import { vite } from '@platformatic/vite'\n\nexport default vite({})\n")

  // Verify that the package.json file was updated with the new dependency
  const packageJson = JSON.parse(await readFile(resolve(applicationPath, 'package.json'), 'utf8'))

  deepStrictEqual(packageJson.dependencies['@platformatic/vite'], `^${version}`)
  ok(typeof packageJson.devDependencies['@platformatic/vite'], 'undefined')

  // Verify that the runtime configuration has an explicit entry for the vite application but with other entries untouched
  runtimeConfig = await readConfiguration(resolve(baseProjectDir, 'watt.config.mjs'), baseProjectDir)

  /*
    Asserted as source: an imported application carries a `url`, which makes it something to fetch
    rather than something the topology already has, so it does not appear among the evaluated
    applications until `wattpm resolve` has run.
  */
  const rootSource = await readFile(resolve(baseProjectDir, 'watt.config.mjs'), 'utf8')

  /*
    Quoting is not asserted: the entry is added by editing the file, which keeps whatever style it
    was written in -- that preservation is the point.
  */
  ok(/["']?id["']?:\s*["']main["']/.test(rootSource), rootSource)
  ok(/["']?id["']?:\s*["']alternate["']/.test(rootSource), rootSource)
  ok(rootSource.includes('git@github.com:hello/world.git'), rootSource)
  deepStrictEqual(runtimeConfig.startTimeout, 12345)

  ok(typeof runtimeConfig.applications, 'undefined')

  // Verify that the .env file was updated
  const envFile = await readFile(resolve(baseProjectDir, '.env'), 'utf-8')

  // Check that all original env variables are still present
  // Normalize line endings to handle Windows (CRLF) vs Unix (LF)
  const originalLines = originalEnvFile.replace(/\r\n/g, '\n').trim().split('\n').filter(line => line.trim())
  const envLines = envFile.replace(/\r\n/g, '\n').trim().split('\n').filter(line => line.trim())

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
    { type: 'select', question: 'Which kind of application do you want to create?', reply: '@platformatic/vite' },
    { type: 'input', question: 'What is the name of the application?', reply: 'main' },
    { type: 'input', question: 'Where is your application located?', reply: sourcePath },
    { type: 'select', question: 'Do you want to import or copy your application?', reply: 'copy' },
    { type: 'select', question: 'Do you want to create another application?', reply: 'no' },
    { type: 'select', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  await executeCreatePlatformatic(root, {
    userInputHandler,
    args: ['--module=@platformatic/vite']
  })

  const baseProjectDir = join(root, 'platformatic')
  const applicationDir = join(baseProjectDir, 'web', 'main')

  // Verify that a configuration file was created and not in the original path
  ok(!existsSync(resolve(sourcePath, 'watt.config.mjs')))
  equal(
    await readFile(resolve(applicationDir, await configurationFileIn(applicationDir)), 'utf8'),
    "import { vite } from '@platformatic/vite'\n\nexport default vite({})\n"
  )

  // Verify that the package.json file was updated with the new dependency and that the original package.json was not modified
  const packageJson = JSON.parse(await readFile(resolve(applicationDir, 'package.json'), 'utf8'))
  deepStrictEqual(packageJson.dependencies['@platformatic/vite'], `^${version}`)
  ok(typeof packageJson.devDependencies['@platformatic/vite'], 'undefined')
  deepStrictEqual(await readFile(resolve(sourcePath, 'package.json'), 'utf8'), originalPackageJson)

  // Verify that the runtime configuration has no explicit entry as everything is in the applications directory
  const runtimeConfig = await readConfiguration(resolve(baseProjectDir, 'watt.config.mjs'), baseProjectDir)
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
    { type: 'select', question: 'Which kind of application do you want to create?', reply: '@platformatic/service' },
    { type: 'input', question: 'What is the name of the application?', reply: 'main' },
    { type: 'select', question: 'Do you want to use TypeScript?', reply: 'no' },
    { type: 'select', question: 'Do you want to create another application?', reply: 'no' },
    { type: 'select', question: 'Do you want to init the git repository?', reply: 'no' }
  ])

  const userInputHandler2 = await setupUserInputHandler(t, [
    { type: 'select', question: 'Which kind of application do you want to create?', reply: '@platformatic/vite' },
    { type: 'input', question: 'What is the name of the application?', reply: 'alternate' },
    { type: 'input', question: 'Where is your application located?', reply: sourcePath },
    { type: 'select', question: 'Do you want to import or copy your application?', reply: 'copy' },
    { type: 'select', question: 'Do you want to create another application?', reply: 'no' }
  ])

  await executeCreatePlatformatic(root, {
    userInputHandler: userInputHandler1
  })

  /*
    Written rather than round-tripped: reading the configuration evaluates it, and what comes back
    is the normalized topology -- entries already under `applications`, with their capability
    configuration resolved. Writing that back and adding a `web` alias beside it describes a project
    nobody has. This is the setup the test is after, spelled directly, in the plain object form that
    a v4 root accepts without imports to resolve.
  */
  await writeFile(
    resolve(join(baseProjectDir, 'watt.config.mjs')),
    `export default ${JSON.stringify(
      {
        autoload: { path: 'web', exclude: ['docs'] },
        web: [{ id: 'main', path: 'services/main' }],
        startTimeout: 12345
      },
      null,
      2
    )}\n`
  )

  await executeCreatePlatformatic(root, {
    userInputHandler: userInputHandler2,
    args: ['--module=@platformatic/vite']
  })

  const applicationDir = join(baseProjectDir, 'web', 'alternate')

  // Verify that a configuration file was created and not in the original path
  ok(!existsSync(resolve(sourcePath, 'watt.config.mjs')))
  equal(
    await readFile(resolve(applicationDir, await configurationFileIn(applicationDir)), 'utf8'),
    "import { vite } from '@platformatic/vite'\n\nexport default vite({})\n"
  )

  // Verify that the package.json file was updated with the new dependency and that the original package.json was not modified
  const packageJson = JSON.parse(await readFile(resolve(applicationDir, 'package.json'), 'utf8'))
  deepStrictEqual(packageJson.dependencies['@platformatic/vite'], `^${version}`)
  ok(typeof packageJson.devDependencies['@platformatic/vite'], 'undefined')
  deepStrictEqual(await readFile(resolve(sourcePath, 'package.json'), 'utf8'), originalPackageJson)

  // Verify that a configuration file was created and not in the original path
  ok(!existsSync(resolve(sourcePath, 'watt.config.mjs')))
  equal(
    await readFile(resolve(applicationDir, await configurationFileIn(applicationDir)), 'utf8'),
    "import { vite } from '@platformatic/vite'\n\nexport default vite({})\n"
  )

  // Verify that the runtime configuration has no explicit entry as everything is in the applications directory
  const runtimeConfig = await readConfiguration(resolve(baseProjectDir, 'watt.config.mjs'), baseProjectDir)
  ok(typeof runtimeConfig.applications, 'undefined')
  ok(typeof runtimeConfig.web, 'undefined')
})
