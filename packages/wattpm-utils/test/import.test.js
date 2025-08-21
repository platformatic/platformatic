import {
  applicationToEnvVariable,
  createDirectory,
  loadConfigurationFile as loadRawConfigurationFile,
  safeRemove,
  saveConfigurationFile
} from '@platformatic/foundation'
import { deepStrictEqual, ok } from 'node:assert'
import { existsSync } from 'node:fs'
import { appendFile, cp, readFile, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { test } from 'node:test'
import { prepareRuntime } from '../../basic/test/helper.js'
import { version } from '../lib/version.js'
import { changeWorkingDirectory, createTemporaryDirectory, executeCommand, wattpmUtils } from './helper.js'

const autodetect = {
  astro: 'astro',
  node: null,
  next: 'next',
  nest: '@nestjs/core',
  remix: '@remix-run/dev',
  vite: 'vite'
}

test('import - should import a URL', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  t.after(() => safeRemove(rootDir))

  const configurationFile = resolve(rootDir, 'watt.json')
  const originalFileContents = await loadRawConfigurationFile(configurationFile)

  changeWorkingDirectory(t, rootDir)
  await wattpmUtils('import', 'http://github.com/foo/bar.git')

  deepStrictEqual(await loadRawConfigurationFile(configurationFile), {
    ...originalFileContents,
    web: [
      {
        id: 'bar',
        path: '{PLT_APPLICATION_BAR_PATH}',
        url: 'http://github.com/foo/bar.git'
      }
    ]
  })

  deepStrictEqual(await readFile(resolve(rootDir, '.env'), 'utf-8'), 'RUNTIME_ENV=foo\nPLT_APPLICATION_BAR_PATH=\n')
  deepStrictEqual(await readFile(resolve(rootDir, '.env.sample'), 'utf-8'), 'PLT_APPLICATION_BAR_PATH=\n')
})

test('import - should import a GitHub repo via SSH', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  t.after(() => safeRemove(rootDir))

  const configurationFile = resolve(rootDir, 'watt.json')
  const originalFileContents = await loadRawConfigurationFile(configurationFile)

  changeWorkingDirectory(t, rootDir)
  await wattpmUtils('import', rootDir, 'foo/bar', '-i', 'id')

  deepStrictEqual(await loadRawConfigurationFile(configurationFile), {
    ...originalFileContents,
    web: [
      {
        id: 'id',
        path: '{PLT_APPLICATION_ID_PATH}',
        url: 'git@github.com:foo/bar.git'
      }
    ]
  })

  deepStrictEqual(await readFile(resolve(rootDir, '.env'), 'utf-8'), 'RUNTIME_ENV=foo\nPLT_APPLICATION_ID_PATH=\n')
  deepStrictEqual(await readFile(resolve(rootDir, '.env.sample'), 'utf-8'), 'PLT_APPLICATION_ID_PATH=\n')
})

test('import - should import a GitHub repo via HTTP', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  t.after(() => safeRemove(rootDir))

  const configurationFile = resolve(rootDir, 'watt.json')
  const originalFileContents = await loadRawConfigurationFile(configurationFile)

  changeWorkingDirectory(t, rootDir)
  await wattpmUtils('import', rootDir, 'foo/bar', '-H', '-i', 'id')

  deepStrictEqual(await loadRawConfigurationFile(configurationFile), {
    ...originalFileContents,
    web: [
      {
        id: 'id',
        path: '{PLT_APPLICATION_ID_PATH}',
        url: 'https://github.com/foo/bar.git'
      }
    ]
  })

  deepStrictEqual(await readFile(resolve(rootDir, '.env'), 'utf-8'), 'RUNTIME_ENV=foo\nPLT_APPLICATION_ID_PATH=\n')
  deepStrictEqual(await readFile(resolve(rootDir, '.env.sample'), 'utf-8'), 'PLT_APPLICATION_ID_PATH=\n')
})

test('import - should import a local folder with a Git remote', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  t.after(() => safeRemove(rootDir))

  const configurationFile = resolve(rootDir, 'watt.json')
  const originalFileContents = await loadRawConfigurationFile(configurationFile)

  const directory = await createTemporaryDirectory(t, 'local-with-git')
  await executeCommand('git', 'init', { cwd: directory })
  await executeCommand('git', 'remote', 'add', 'origin', 'git@github.com:hello/world.git', { cwd: directory })
  await writeFile(resolve(directory, 'index.js'), '', 'utf-8')
  const id = basename(directory)
  const envVariable = applicationToEnvVariable(id)

  changeWorkingDirectory(t, rootDir)
  await wattpmUtils('import', directory)

  deepStrictEqual(await loadRawConfigurationFile(configurationFile), {
    ...originalFileContents,
    web: [
      {
        id,
        path: `{${envVariable}}`,
        url: 'git@github.com:hello/world.git'
      }
    ]
  })

  deepStrictEqual(await readFile(resolve(rootDir, '.env'), 'utf-8'), `RUNTIME_ENV=foo\n${envVariable}=${directory}\n`)
  deepStrictEqual(await readFile(resolve(rootDir, '.env.sample'), 'utf-8'), `${envVariable}=\n`)
})

test('import - should import a local folder without a Git remote', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  t.after(() => safeRemove(rootDir))

  const configurationFile = resolve(rootDir, 'watt.json')
  const originalFileContents = await loadRawConfigurationFile(configurationFile)

  const directory = await createTemporaryDirectory(t, 'local-with-git')
  await writeFile(resolve(directory, 'index.js'), '', 'utf-8')
  const id = basename(directory)
  const envVariable = applicationToEnvVariable(id)

  changeWorkingDirectory(t, rootDir)
  const importProcess = await wattpmUtils('import', directory)

  deepStrictEqual(await loadRawConfigurationFile(configurationFile), {
    ...originalFileContents,
    web: [
      {
        id,
        path: `{${envVariable}}`
      }
    ]
  })

  deepStrictEqual(await readFile(resolve(rootDir, '.env'), 'utf-8'), `RUNTIME_ENV=foo\n${envVariable}=${directory}\n`)
  deepStrictEqual(await readFile(resolve(rootDir, '.env.sample'), 'utf-8'), `${envVariable}=\n`)

  ok(importProcess.stdout.includes(`The application ${id} does not define a Git repository.`))
})

test('import - should import a local folder within the repository without using environment variables or URLs', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  t.after(() => safeRemove(rootDir))

  const configurationFile = resolve(rootDir, 'watt.json')
  const originalFileContents = await loadRawConfigurationFile(configurationFile)

  const id = 'in-a-repo'
  const path = join('this', 'is', 'in-a-repo') // This is for Windows compatibility
  const absolute = resolve(rootDir, path)
  await createDirectory(absolute)
  await writeFile(resolve(absolute, 'index.js'), '', 'utf-8')

  await executeCommand('git', 'init', { cwd: absolute })
  await executeCommand('git', 'remote', 'add', 'origin', 'git@github.com:hello/world.git', { cwd: absolute })

  changeWorkingDirectory(t, rootDir)
  await wattpmUtils('import', resolve(rootDir, path))

  deepStrictEqual(await loadRawConfigurationFile(configurationFile), {
    ...originalFileContents,
    web: [
      {
        id,
        path
      }
    ]
  })

  deepStrictEqual(await readFile(resolve(rootDir, '.env'), 'utf-8'), 'RUNTIME_ENV=foo')
  ok(!existsSync(resolve(rootDir, '.env.sample')))
})

test('import - should not do anything when the local folder is already an autoloaded application', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  t.after(() => safeRemove(rootDir))

  const configurationFile = resolve(rootDir, 'watt.json')

  const originalFileContents = await readFile(configurationFile, 'utf-8')

  changeWorkingDirectory(t, rootDir)
  const importProcess = await wattpmUtils('import', resolve(rootDir, 'web/main'))

  deepStrictEqual(await readFile(configurationFile, 'utf-8'), originalFileContents)
  deepStrictEqual(await readFile(resolve(rootDir, '.env'), 'utf-8'), 'RUNTIME_ENV=foo')
  ok(!existsSync(resolve(rootDir, '.env.sample')))

  deepStrictEqual(importProcess.exitCode, 0)
  ok(importProcess.stdout.includes('The path is already autoloaded as an application.'))
})

test('import - should not do anything when the local folder is already a defined application', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  t.after(() => safeRemove(rootDir))

  const configurationFile = resolve(rootDir, 'watt.json')

  const contents = await loadRawConfigurationFile(configurationFile)
  contents.web = [{ id: 'main', path: 'main' }]
  await saveConfigurationFile(configurationFile, contents)
  await createDirectory(resolve(rootDir, 'main'))
  await writeFile(resolve(rootDir, 'main/index.js'), '', 'utf-8')
  await cp(resolve(rootDir, 'web/main/watt.json'), resolve(rootDir, 'main/watt.json'))

  const originalFileContents = await readFile(configurationFile, 'utf-8')

  changeWorkingDirectory(t, rootDir)
  const importProcess = await wattpmUtils('import', 'main')

  deepStrictEqual(await readFile(configurationFile, 'utf-8'), originalFileContents)
  deepStrictEqual(await readFile(resolve(rootDir, '.env'), 'utf-8'), 'RUNTIME_ENV=foo')
  ok(!existsSync(resolve(rootDir, '.env.sample')))

  deepStrictEqual(importProcess.exitCode, 0)
  ok(importProcess.stdout.includes('The path is already defined as an application.'))
})

test('import - should not do anything when loaded vian application file', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  t.after(() => safeRemove(rootDir))
  await safeRemove(resolve(rootDir, 'watt.json'))

  const configurationFile = resolve(rootDir, 'web/main/watt.json')
  const originalFileContents = await readFile(configurationFile, 'utf-8')

  changeWorkingDirectory(t, resolve(rootDir, 'web/main'))
  const importProcess = await wattpmUtils('import', '.')

  deepStrictEqual(await readFile(configurationFile, 'utf-8'), originalFileContents)
  ok(importProcess.stdout.includes('The path is already defined as an application.'))
})

test('import - should raise an error when importing if the application id is already taken', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  t.after(() => safeRemove(rootDir))

  const configurationFile = resolve(rootDir, 'watt.json')
  const originalFileContents = await readFile(configurationFile, 'utf-8')

  changeWorkingDirectory(t, rootDir)
  const importProcess = await wattpmUtils('import', rootDir, 'foo/bar', '-i', 'main', { reject: false })

  deepStrictEqual(await readFile(configurationFile, 'utf-8'), originalFileContents)
  deepStrictEqual(await readFile(resolve(rootDir, '.env'), 'utf-8'), 'RUNTIME_ENV=foo')
  ok(!existsSync(resolve(rootDir, '.env.sample')))

  deepStrictEqual(importProcess.exitCode, 1)
  ok(importProcess.stdout.includes('There is already an application main defined, please choose a different application ID.'))
})

test('import - should raise an error when importing if the environment variable is already defined', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  t.after(() => safeRemove(rootDir))

  const configurationFile = resolve(rootDir, 'watt.json')
  const originalFileContents = await readFile(configurationFile, 'utf-8')

  await appendFile(resolve(rootDir, '.env'), '\nPLT_APPLICATION_BAR_PATH=foo\n')
  const originalEnv = await readFile(resolve(rootDir, '.env'), 'utf-8')

  changeWorkingDirectory(t, rootDir)
  const importProcess = await wattpmUtils('import', rootDir, 'foo/bar', { reject: false })

  deepStrictEqual(await readFile(configurationFile, 'utf-8'), originalFileContents)
  deepStrictEqual(await readFile(resolve(rootDir, '.env'), 'utf-8'), originalEnv)
  ok(!existsSync(resolve(rootDir, '.env.sample')))

  deepStrictEqual(importProcess.exitCode, 1)
  ok(
    importProcess.stdout.includes(
      'There is already an environment variable PLT_APPLICATION_BAR_PATH defined, please choose a different application ID.'
    )
  )
})

test('import - should properly manage environment files', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  t.after(() => safeRemove(rootDir))

  const configurationFile = resolve(rootDir, 'watt.json')
  const originalFileContents = await loadRawConfigurationFile(configurationFile)

  await cp(resolve(rootDir, '.env'), resolve(rootDir, '.env.sample'))
  await safeRemove(resolve(rootDir, '.env'))

  changeWorkingDirectory(t, rootDir)
  await wattpmUtils('import', 'http://github.com/foo/bar.git')

  deepStrictEqual(await loadRawConfigurationFile(configurationFile), {
    ...originalFileContents,
    web: [
      {
        id: 'bar',
        path: '{PLT_APPLICATION_BAR_PATH}',
        url: 'http://github.com/foo/bar.git'
      }
    ]
  })

  // The .env has been created
  deepStrictEqual(await readFile(resolve(rootDir, '.env'), 'utf-8'), 'PLT_APPLICATION_BAR_PATH=\n')

  // The .env.sample has been updated
  deepStrictEqual(await readFile(resolve(rootDir, '.env.sample'), 'utf-8'), 'RUNTIME_ENV=foo\nPLT_APPLICATION_BAR_PATH=\n')
})

test('import - should not modify existing watt.json files when exporting local folders', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  t.after(() => safeRemove(rootDir))

  const configurationFile = resolve(rootDir, 'watt.json')
  const originalFileContents = await loadRawConfigurationFile(configurationFile)

  const directory = await createTemporaryDirectory(t, 'local-with-git')
  await writeFile(resolve(directory, 'index.js'), '', 'utf-8')
  await writeFile(resolve(directory, 'watt.json'), JSON.stringify({ foo: 'bar' }), 'utf-8')
  const id = basename(directory)
  const envVariable = applicationToEnvVariable(id)

  changeWorkingDirectory(t, rootDir)
  await wattpmUtils('import', directory)

  deepStrictEqual(await loadRawConfigurationFile(configurationFile), {
    ...originalFileContents,
    web: [
      {
        id,
        path: `{${envVariable}}`
      }
    ]
  })

  deepStrictEqual(await readFile(resolve(rootDir, '.env'), 'utf-8'), `RUNTIME_ENV=foo\n${envVariable}=${directory}\n`)
  deepStrictEqual(await readFile(resolve(rootDir, '.env.sample'), 'utf-8'), `${envVariable}=\n`)
  deepStrictEqual(await loadRawConfigurationFile(resolve(directory, 'watt.json')), { foo: 'bar' })
})

for (const [name, dependency] of Object.entries(autodetect)) {
  test(`import - should correctly autodetect a @platformatic/${name} capability when importing local folders`, async t => {
    const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
    t.after(() => safeRemove(rootDir))

    const configurationFile = resolve(rootDir, 'watt.json')
    const originalFileContents = await loadRawConfigurationFile(configurationFile)

    const directory = await createTemporaryDirectory(t, 'local-with-git')
    await writeFile(resolve(directory, 'index.js'), '', 'utf-8')
    if (dependency) {
      await writeFile(
        resolve(directory, 'package.json'),
        JSON.stringify({ dependencies: { [dependency]: '*' } }),
        'utf-8'
      )
    }

    const id = basename(directory)
    const envVariable = applicationToEnvVariable(id)

    changeWorkingDirectory(t, rootDir)
    await wattpmUtils('import', directory)

    deepStrictEqual(await loadRawConfigurationFile(configurationFile), {
      ...originalFileContents,
      web: [
        {
          id,
          path: `{${envVariable}}`
        }
      ]
    })

    deepStrictEqual(await readFile(resolve(rootDir, '.env'), 'utf-8'), `RUNTIME_ENV=foo\n${envVariable}=${directory}\n`)
    deepStrictEqual(await readFile(resolve(rootDir, '.env.sample'), 'utf-8'), `${envVariable}=\n`)

    deepStrictEqual(await loadRawConfigurationFile(resolve(directory, 'package.json')), {
      dependencies: {
        ...(dependency ? { [dependency]: '*' } : {}),
        [`@platformatic/${name}`]: `^${version}`
      }
    })

    deepStrictEqual(await loadRawConfigurationFile(resolve(directory, 'watt.json')), {
      $schema: `https://schemas.platformatic.dev/@platformatic/${name}/${version}.json`
    })
  })
}

test('import - should fail when an application type cannot be detected', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  t.after(() => safeRemove(rootDir))

  const directory = await createTemporaryDirectory(t, 'local-with-git')

  changeWorkingDirectory(t, rootDir)
  const importProcess = await wattpmUtils('import', directory, { reject: false })

  deepStrictEqual(importProcess.exitCode, 1)
  ok(importProcess.stdout.includes(`The path ${directory} does not contain a supported application.`))
})

test('import - when launched without arguments, should fix the configuration of all known applications', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'no-dependencies', false, 'watt.json')
  t.after(() => safeRemove(rootDir))

  const configurationFile = resolve(rootDir, 'watt.json')
  const originalFileContents = await loadRawConfigurationFile(configurationFile)

  changeWorkingDirectory(t, rootDir)
  const importProcess = await wattpmUtils('import')

  deepStrictEqual(await loadRawConfigurationFile(configurationFile), originalFileContents)

  for (const applicationPath of ['web-1/first', 'web-1/second']) {
    deepStrictEqual(await loadRawConfigurationFile(resolve(rootDir, applicationPath, 'package.json')), {
      dependencies: {
        '@platformatic/node': `^${version}`
      },
      devDependencies: {}
    })

    deepStrictEqual(await loadRawConfigurationFile(resolve(rootDir, applicationPath, 'watt.json')), {
      $schema: `https://schemas.platformatic.dev/@platformatic/node/${version}.json`
    })
  }

  deepStrictEqual(await loadRawConfigurationFile(resolve(rootDir, 'web-2/third/watt.json')), { foo: 'bar' })

  ok(
    importProcess.stdout.includes(
      'Application first is a generic Node.js application. Adding @platformatic/node to its package.json dependencies.'
    )
  )
  ok(
    importProcess.stdout.includes(
      'Application second is a generic Node.js application. Adding @platformatic/node to its package.json dependencies.'
    )
  )
  ok(
    importProcess.stdout.includes(
      'Application fourth is using Vite. Adding @platformatic/vite to its package.json dependencies.'
    )
  )
  ok(
    !importProcess.stdout.includes(
      'Application thid is a generic Node.js application. Adding @platformatic/node to its package.json dependencies.'
    )
  )
  ok(importProcess.stdout.includes('Installing dependencies for the application using npm ...'))
  ok(importProcess.stdout.includes('Installing dependencies for the application first using npm ...'))
  ok(importProcess.stdout.includes('Installing dependencies for the application second using npm ...'))
  ok(importProcess.stdout.includes('Installing dependencies for the application fourth using npm ...'))
  ok(importProcess.stdout.includes('Installing dependencies for the application third using npm ...'))
})

test('import - when launched without arguments, should fix the configuration of all known applications without installing dependencies', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'no-dependencies', false, 'watt.json')
  t.after(() => safeRemove(rootDir))

  const configurationFile = resolve(rootDir, 'watt.json')
  const originalFileContents = await loadRawConfigurationFile(configurationFile)

  changeWorkingDirectory(t, rootDir)
  const importProcess = await wattpmUtils('import', '-s')

  deepStrictEqual(await loadRawConfigurationFile(configurationFile), originalFileContents)

  for (const applicationPath of ['web-1/first', 'web-1/second']) {
    deepStrictEqual(await loadRawConfigurationFile(resolve(rootDir, applicationPath, 'package.json')), {
      dependencies: {
        '@platformatic/node': `^${version}`
      },
      devDependencies: {}
    })

    deepStrictEqual(await loadRawConfigurationFile(resolve(rootDir, applicationPath, 'watt.json')), {
      $schema: `https://schemas.platformatic.dev/@platformatic/node/${version}.json`
    })
  }

  deepStrictEqual(await loadRawConfigurationFile(resolve(rootDir, 'web-2/third/watt.json')), { foo: 'bar' })

  ok(
    importProcess.stdout.includes(
      'Application first is a generic Node.js application. Adding @platformatic/node to its package.json dependencies.'
    )
  )
  ok(
    importProcess.stdout.includes(
      'Application second is a generic Node.js application. Adding @platformatic/node to its package.json dependencies.'
    )
  )
  ok(
    importProcess.stdout.includes(
      'Application fourth is using Vite. Adding @platformatic/vite to its package.json dependencies.'
    )
  )
  ok(
    !importProcess.stdout.includes(
      'Application thid is a generic Node.js application. Adding @platformatic/node to its package.json dependencies.'
    )
  )
  ok(!importProcess.stdout.includes('Installing dependencies for the application using npm ...'))
  ok(!importProcess.stdout.includes('Installing dependencies for the application first using npm ...'))
  ok(!importProcess.stdout.includes('Installing dependencies for the application second using npm ...'))
  ok(!importProcess.stdout.includes('Installing dependencies for the application fourth using npm ...'))
  ok(!importProcess.stdout.includes('Installing dependencies for the application third using npm ...'))
})

test('import - when launched without arguments from an application file, should not do anything', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  t.after(() => safeRemove(rootDir))

  await safeRemove(resolve(rootDir, 'watt.json'))
  await saveConfigurationFile(resolve(rootDir, 'web/main/watt.json'), {
    $schema: 'https://schemas.platformatic.dev/@platformatic/node/2.3.1.json'
  })

  changeWorkingDirectory(t, resolve(rootDir, 'web/main'))
  const importProcess = await wattpmUtils('import')

  deepStrictEqual(await loadRawConfigurationFile(resolve(rootDir, 'web/main/package.json')), {
    dependencies: {
      '@platformatic/node': '^2.3.1'
    },
    type: 'module'
  })

  ok(!importProcess.stdout.includes('Detected capability'))
})

test('import - should find the nearest watt.json', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  t.after(() => safeRemove(rootDir))

  const configurationFile = resolve(rootDir, 'watt.json')
  const originalFileContents = await loadRawConfigurationFile(configurationFile)

  const directory = resolve(rootDir, 'web/next')
  await createDirectory(directory)
  await writeFile(resolve(directory, 'index.js'), '', 'utf-8')

  changeWorkingDirectory(t, resolve(rootDir, 'web/next'))
  await wattpmUtils('import', '.')

  deepStrictEqual(await loadRawConfigurationFile(configurationFile), originalFileContents)

  ok(!existsSync(resolve(directory, 'web/next/package.json')))
  ok(!existsSync(resolve(directory, 'web/next/watt.json')))
})
