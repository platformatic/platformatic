import { safeRemove } from '@platformatic/utils'
import { deepStrictEqual, ok } from 'node:assert'
import { existsSync } from 'node:fs'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join, resolve, sep } from 'node:path'
import { test } from 'node:test'
import { prepareRuntime } from '../../basic/test/helper.js'
import { defaultServiceJson } from '../lib/defaults.js'
import { version } from '../lib/schema.js'
import { createTemporaryDirectory, executeCommand, fixturesDir, wattpm } from './helper.js'

test('import - should import a URL', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const configurationFile = resolve(rootDir, 'watt.json')
  const originalFileContents = await readFile(configurationFile, 'utf-8')

  process.chdir(rootDir)
  await wattpm('import', 'http://github.com/foo/bar.git')

  deepStrictEqual(JSON.parse(await readFile(configurationFile, 'utf-8')), {
    ...JSON.parse(originalFileContents),
    web: [
      {
        id: 'bar',
        path: 'web/bar',
        url: 'http://github.com/foo/bar.git'
      }
    ]
  })
})

test('import - should import a GitHub repo via SSH', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const configurationFile = resolve(rootDir, 'watt.json')
  const originalFileContents = await readFile(configurationFile, 'utf-8')

  process.chdir(rootDir)
  await wattpm('import', rootDir, 'foo/bar', '-i', 'id', '-p', 'path')

  deepStrictEqual(JSON.parse(await readFile(configurationFile, 'utf-8')), {
    ...JSON.parse(originalFileContents),
    web: [
      {
        id: 'id',
        path: 'path',
        url: 'git@github.com:foo/bar.git'
      }
    ]
  })
})

test('import - should import a GitHub repo via HTTP', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const configurationFile = resolve(rootDir, 'watt.json')
  const originalFileContents = await readFile(configurationFile, 'utf-8')

  process.chdir(rootDir)
  await wattpm('import', rootDir, 'foo/bar', '-h', '-i', 'id', '-p', 'path')

  deepStrictEqual(JSON.parse(await readFile(configurationFile, 'utf-8')), {
    ...JSON.parse(originalFileContents),
    web: [
      {
        id: 'id',
        path: 'path',
        url: 'https://github.com/foo/bar.git'
      }
    ]
  })
})

test('import - should import a local folder with Git and no watt.json', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const configurationFile = resolve(rootDir, 'watt.json')
  const originalFileContents = await readFile(configurationFile, 'utf-8')

  const directory = await createTemporaryDirectory(t, 'local-with-git')
  await cp(resolve(rootDir, 'web/main/index.js'), resolve(directory, 'index.js'))
  await executeCommand('git', 'init', { cwd: directory })
  await executeCommand('git', 'remote', 'add', 'origin', 'git@github.com:hello/world.git', { cwd: directory })

  process.chdir(rootDir)
  await wattpm('import', rootDir, directory)

  deepStrictEqual(JSON.parse(await readFile(configurationFile, 'utf-8')), {
    ...JSON.parse(originalFileContents),
    web: [
      {
        id: basename(directory),
        path: directory,
        url: 'git@github.com:hello/world.git'
      }
    ]
  })

  deepStrictEqual(JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf-8')), {
    dependencies: {
      '@platformatic/node': `^${version}`
    }
  })

  deepStrictEqual(JSON.parse(await readFile(resolve(directory, 'watt.json'), 'utf-8')), {
    ...defaultServiceJson,
    $schema: `https://schemas.platformatic.dev/@platformatic/node/${version}.json`
  })
})

test('import - should import a local folder without Git and a watt.json', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const configurationFile = resolve(rootDir, 'watt.json')
  const originalFileContents = await readFile(configurationFile, 'utf-8')

  const directory = await createTemporaryDirectory(t, 'local-no-git')
  await cp(resolve(rootDir, 'web/main/index.js'), resolve(directory, 'index.js'))
  await writeFile(resolve(directory, 'watt.json'), JSON.stringify({ a: 1 }), 'utf-8')

  process.chdir(rootDir)
  await wattpm('import', rootDir, directory)

  deepStrictEqual(JSON.parse(await readFile(configurationFile, 'utf-8')), {
    ...JSON.parse(originalFileContents),
    web: [
      {
        id: basename(directory),
        path: directory
      }
    ]
  })

  ok(!existsSync(resolve(directory, 'package.json'), 'utf-8'))
  deepStrictEqual(JSON.parse(await readFile(resolve(directory, 'watt.json'), 'utf-8')), { a: 1 })
})

test('import - should not modify the root watt.json when importing a folder which is already autoloaded', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const configurationFile = resolve(rootDir, 'watt.json')
  const originalFileContents = await readFile(configurationFile, 'utf-8')

  const directory = join('web', basename(await createTemporaryDirectory(t, 'local-with-git')))
  const absoluteDirectory = resolve(rootDir, directory)
  await mkdir(absoluteDirectory)
  await cp(resolve(rootDir, 'web/main/index.js'), resolve(rootDir, directory, 'index.js'))

  t.after(() => safeRemove(absoluteDirectory))

  process.chdir(rootDir)
  await wattpm('import', rootDir, directory)

  deepStrictEqual(JSON.parse(await readFile(configurationFile, 'utf-8')), {
    ...JSON.parse(originalFileContents)
  })

  deepStrictEqual(JSON.parse(await readFile(resolve(rootDir, directory, 'package.json'), 'utf-8')), {
    dependencies: {
      '@platformatic/node': `^${version}`
    }
  })

  deepStrictEqual(JSON.parse(await readFile(resolve(rootDir, directory, 'watt.json'), 'utf-8')), {
    ...defaultServiceJson,
    $schema: `https://schemas.platformatic.dev/@platformatic/node/${version}.json`
  })
})

const autodetect = {
  astro: 'astro',
  next: 'next',
  remix: '@remix-run/dev',
  vite: 'vite'
}

for (const [name, dependency] of Object.entries(autodetect)) {
  test(`import - should correctly autodetect a @platformatic/${name} stackable`, async t => {
    const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
    const configurationFile = resolve(rootDir, 'watt.json')
    const originalFileContents = await readFile(configurationFile, 'utf-8')

    const directory = await createTemporaryDirectory(t, `local-${name}`)
    await writeFile(
      resolve(directory, 'package.json'),
      JSON.stringify({ dependencies: { [dependency]: '*' } }),
      'utf-8'
    )

    process.chdir(rootDir)
    await wattpm('import', rootDir, directory)

    deepStrictEqual(JSON.parse(await readFile(configurationFile, 'utf-8')), {
      ...JSON.parse(originalFileContents),
      web: [
        {
          id: basename(directory),
          path: directory
        }
      ]
    })

    deepStrictEqual(JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf-8')), {
      dependencies: {
        [dependency]: '*',
        [`@platformatic/${name}`]: `^${version}`
      }
    })

    deepStrictEqual(JSON.parse(await readFile(resolve(directory, 'watt.json'), 'utf-8')), {
      ...defaultServiceJson,
      $schema: `https://schemas.platformatic.dev/@platformatic/${name}/${version}.json`
    })
  })
}

test('import - when launched without arguments, should fix the configuration of all known services', async t => {
  const rootDir = resolve(fixturesDir, 'no-dependencies')
  const configurationFile = resolve(rootDir, 'watt.json')
  const originalFileContents = await readFile(configurationFile, 'utf-8')

  t.after(() => {
    return Promise.all([
      safeRemove(resolve(rootDir, 'web-1/first/watt.json')),
      safeRemove(resolve(rootDir, 'web-1/first/package.json')),
      safeRemove(resolve(rootDir, 'web-1/second/watt.json')),
      safeRemove(resolve(rootDir, 'web-1/second/package.json')),
      safeRemove(resolve(rootDir, 'web-2/third/watt.json')),
      safeRemove(resolve(rootDir, 'web-2/third/package.json'))
    ])
  })

  process.chdir(rootDir)
  await wattpm('import')

  deepStrictEqual(await readFile(configurationFile, 'utf-8'), originalFileContents)

  for (const servicePath of ['web-1/first', 'web-1/second', 'web-2/third']) {
    deepStrictEqual(JSON.parse(await readFile(resolve(rootDir, servicePath, 'package.json'), 'utf-8')), {
      dependencies: {
        '@platformatic/node': `^${version}`
      }
    })

    deepStrictEqual(JSON.parse(await readFile(resolve(rootDir, servicePath, 'watt.json'), 'utf-8')), {
      ...defaultServiceJson,
      $schema: `https://schemas.platformatic.dev/@platformatic/node/${version}.json`
    })
  }
})

test('import - should find the nearest watt.json', async t => {
  const fixture = resolve(fixturesDir, 'main')
  const rootDir = await createTemporaryDirectory(t, 'local-no-git')

  await cp(fixture, rootDir, { recursive: true })

  const configurationFile = resolve(rootDir, 'watt.json')
  const originalFileContents = await readFile(configurationFile, 'utf-8')

  const directory = join(rootDir, 'web', 'next')
  await mkdir(directory, { recursive: true })

  process.chdir(join(rootDir, 'web', 'next'))
  await wattpm('import', '.')

  deepStrictEqual(JSON.parse(await readFile(configurationFile, 'utf-8')), JSON.parse(originalFileContents))

  ok(!existsSync(resolve(directory, 'web', 'next', 'package.json'), 'utf-8'))
  deepStrictEqual(JSON.parse(await readFile(join(rootDir, 'watt.json'), 'utf-8')), {
    ...JSON.parse(originalFileContents)
  })
  deepStrictEqual(JSON.parse(await readFile(join(rootDir, 'web', 'next', 'watt.json'), 'utf-8')), {
    $schema: `https://schemas.platformatic.dev/@platformatic/node/${version}.json`
  })
})

test('resolve - should clone a URL', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  t.after(() => safeRemove(resolve(rootDir, 'web/resolved')))

  process.chdir(rootDir)
  await wattpm('import', rootDir, '-h', '-i', 'resolved', '-p', 'web/resolved', 'mcollina/undici-thread-interceptor')
  const resolveProcess = await wattpm('resolve', rootDir)

  ok(
    resolveProcess.stdout.includes(
      `Cloning https://github.com/mcollina/undici-thread-interceptor.git into web${sep}resolved`
    )
  )
  ok(resolveProcess.stdout.includes('Installing dependencies ...'))
})

// Note that this test purposely uses gitlab to have a HTTP authentication error, GitHub ignores those parameters
test('resolve - should attempt to clone with username and password', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  t.after(() => safeRemove(resolve(rootDir, 'web/resolved')))

  process.chdir(rootDir)
  await wattpm(
    'import',
    rootDir,
    '-i',
    'resolved',
    '-p',
    'web/resolved',
    'https://gitlab.com/mcollina/undici-thread-interceptor.git'
  )
  const resolveProcess = await wattpm('resolve', '-u', 'foo', '-p', 'bar', rootDir, { reject: false })

  deepStrictEqual(resolveProcess.exitCode, 1)
  ok(
    resolveProcess.stdout.includes(
      `Cloning https://gitlab.com/mcollina/undici-thread-interceptor.git as user foo into web${sep}resolved`
    )
  )
  ok(resolveProcess.stdout.includes('HTTP Basic: Access denied'))
})
