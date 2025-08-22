import { getPlatformaticVersion, safeRemove } from '@platformatic/foundation'
import assert from 'node:assert'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import test from 'node:test'
import { MockAgent, setGlobalDispatcher } from 'undici'
import { Generator as ComposerGenerator } from '../../composer/lib/generator.js'
import { Generator as ApplicationGenerator } from '../../service/lib/generator.js'
import { RuntimeGenerator, WrappedGenerator } from '../lib/generator.js'

const mockAgent = new MockAgent()
setGlobalDispatcher(mockAgent)
mockAgent.disableNetConnect()

let tmpCount = 0
async function createTemporaryDirectory (t, prefix) {
  const directory = join(tmpdir(), `test-runtime-${prefix}-${process.pid}-${tmpCount++}`)

  t.after(async () => {
    await safeRemove(directory)
  })

  await mkdir(directory)
  return directory
}

test('RuntimeGenerator - should create a runtime with 2 applications', async () => {
  const rg = new RuntimeGenerator({
    targetDirectory: '/tmp/runtime'
  })

  // adding one application
  const firstApplication = new ApplicationGenerator()
  firstApplication.addEnvVar('FOO', 'bar', { overwrite: false, default: true })
  firstApplication.addEnvVar('FOO', 'foo', { overwrite: true, default: false })
  rg.addApplication(firstApplication, 'first-service')

  // adding another application
  const secondApplication = new ApplicationGenerator()
  rg.addApplication(secondApplication, 'second-service')

  rg.setEntryPoint('first-service')

  rg.setConfig({
    port: 3043,
    logLevel: 'debug'
  })

  const output = await rg.prepare()

  assert.deepEqual(output, {
    targetDirectory: '/tmp/runtime',
    env: {
      PLT_FIRST_SERVICE_FOO: 'foo',
      PLT_SERVER_HOSTNAME: '127.0.0.1',
      PLT_SERVER_LOGGER_LEVEL: 'debug',
      PLT_MANAGEMENT_API: true,
      PORT: 3043
    }
  })

  // should list only runtime files
  const runtimeFileList = rg.listFiles()
  assert.deepEqual(runtimeFileList, ['package.json', 'platformatic.json', '.env', '.env.sample', '.gitignore'])

  // applications have correct target directory
  assert.equal(
    firstApplication.targetDirectory,
    join(rg.targetDirectory, 'applications', firstApplication.config.applicationName)
  )
  assert.equal(
    secondApplication.targetDirectory,
    join(rg.targetDirectory, 'applications', secondApplication.config.applicationName)
  )

  // Should have correct env variables
  const env = rg.getFileObject('.env')
  const envSample = rg.getFileObject('.env.sample')

  assert.notDeepStrictEqual(env.contents.split(/\r?\n/), envSample.contents.split(/\r?\n/))
})

test('RuntimeGenerator - should have a valid package.json', async () => {
  const rg = new RuntimeGenerator({
    name: 'test-runtime',
    targetDirectory: '/tmp/runtime'
  })

  const firstApplication = new ApplicationGenerator()
  firstApplication.setConfig({
    isRuntimeContext: false
  })
  rg.addApplication(firstApplication, 'first-service')

  rg.setEntryPoint('first-service')

  rg.setConfig({
    port: 3043,
    logLevel: 'debug'
  })

  await rg.prepare()
  const packageJson = JSON.parse(rg.getFileObject('package.json').contents)
  assert.equal(packageJson.name, 'test-runtime')
  assert.deepStrictEqual(packageJson.workspaces, ['applications/*'])

  assert.ok(packageJson.dependencies['@platformatic/runtime'])
})

test('RuntimeGenerator - should have applications plugin dependencies in package.json', async () => {
  const rg = new RuntimeGenerator({
    targetDirectory: '/tmp/runtime'
  })

  // adding one application
  const firstApplication = new ApplicationGenerator()
  firstApplication.setConfig({
    isRuntimeContext: false
  })
  await firstApplication.addPackage({
    name: '@fastify/helmet',
    options: []
  })
  rg.addApplication(firstApplication, 'first-service')

  rg.setEntryPoint('first-service')

  rg.setConfig({
    port: 3043,
    logLevel: 'debug'
  })

  const output = await rg.prepare()
  // runtime package.json has the application dependencies
  const packageJson = JSON.parse(rg.getFileObject('package.json').contents)
  assert.equal(packageJson.dependencies['@fastify/helmet'], 'latest')

  assert.deepEqual(output, {
    targetDirectory: '/tmp/runtime',
    env: {
      PLT_SERVER_HOSTNAME: '127.0.0.1',
      PLT_MANAGEMENT_API: true,
      PLT_SERVER_LOGGER_LEVEL: 'debug',
      PORT: 3043
    }
  })
})

test('RuntimeGenerator - should create a runtime with 1 application and 1 db', async () => {
  const rg = new RuntimeGenerator({
    targetDirectory: '/tmp/runtime'
  })

  // adding one application
  const firstApplication = new ApplicationGenerator()
  firstApplication.setConfig({
    env: {
      APPLICATION_1: 'foo'
    }
  })
  rg.addApplication(firstApplication, 'first-service')

  // adding another application
  const secondApplication = new ApplicationGenerator()
  secondApplication.setConfig({
    env: {
      APPLICATION_2: 'foo'
    }
  })
  rg.addApplication(secondApplication, 'second-service')

  rg.setEntryPoint('first-service')

  rg.setConfig({
    port: 3043
  })

  const output = await rg.prepare()

  assert.deepEqual(output, {
    targetDirectory: '/tmp/runtime',
    env: {
      PLT_FIRST_SERVICE_APPLICATION_1: 'foo',
      PLT_SECOND_SERVICE_APPLICATION_2: 'foo',
      PLT_SERVER_HOSTNAME: '127.0.0.1',
      PLT_MANAGEMENT_API: true,
      PLT_SERVER_LOGGER_LEVEL: 'info',
      PORT: 3043
    }
  })

  // should list only runtime files
  const runtimeFileList = rg.listFiles()
  assert.deepEqual(runtimeFileList, ['package.json', 'platformatic.json', '.env', '.env.sample', '.gitignore'])

  // applications have correct target directory
  assert.equal(
    firstApplication.targetDirectory,
    join(rg.targetDirectory, 'applications', firstApplication.config.applicationName)
  )
  assert.equal(
    secondApplication.targetDirectory,
    join(rg.targetDirectory, 'applications', secondApplication.config.applicationName)
  )
})

test('RuntimeGenerator - should create a runtime with 2 applications and 2 composers', async () => {
  const rg = new RuntimeGenerator({
    targetDirectory: '/tmp/runtime'
  })

  // adding one application
  const firstApplication = new ApplicationGenerator()
  rg.addApplication(firstApplication, 'first-service')

  // adding another application
  const secondApplication = new ApplicationGenerator()
  rg.addApplication(secondApplication, 'second-service')

  // adding composers
  const firstComposer = new ComposerGenerator()
  rg.addApplication(firstComposer, 'first-composer')
  const secondComposer = new ComposerGenerator()
  rg.addApplication(secondComposer, 'second-composer')

  rg.setEntryPoint('first-service')

  rg.setConfig({
    port: 3043
  })

  await rg.prepare()

  // double check config files
  const firstComposerConfigFile = firstComposer.getFileObject('platformatic.json')
  const firstComposerConfigFileJson = JSON.parse(firstComposerConfigFile.contents)
  assert.deepEqual(firstComposerConfigFileJson.composer.applications, [
    {
      id: 'first-service',
      openapi: {
        url: '/documentation/json',
        prefix: '/first-service'
      }
    },
    {
      id: 'second-service',
      openapi: {
        url: '/documentation/json',
        prefix: '/second-service'
      }
    }
  ])

  const secondComposerConfigFile = secondComposer.getFileObject('platformatic.json')
  const secondComposerConfigFileJson = JSON.parse(secondComposerConfigFile.contents)
  assert.deepEqual(secondComposerConfigFileJson.composer.applications, [
    {
      id: 'first-service',
      openapi: {
        url: '/documentation/json',
        prefix: '/first-service'
      }
    },
    {
      id: 'second-service',
      openapi: {
        url: '/documentation/json',
        prefix: '/second-service'
      }
    }
  ])
})

test('RuntimeGenerator - add applications to an existing folder', async t => {
  const targetDirectory = await mkdtemp(join(tmpdir(), 'platformatic-runtime-generator-'))

  t.after(async () => {
    await safeRemove(targetDirectory)
  })

  {
    const rg = new RuntimeGenerator({
      targetDirectory
    })

    // adding one application
    const firstApplication = new ApplicationGenerator()
    rg.addApplication(firstApplication, 'first-service')

    // adding another application
    const secondApplication = new ApplicationGenerator()
    rg.addApplication(secondApplication, 'second-service')

    rg.setEntryPoint('first-service')

    rg.setConfig({
      port: 3043
    })

    await rg.prepare()
    await rg.writeFiles()
  }

  {
    const rg = new RuntimeGenerator({
      targetDirectory
    })

    // adding another application
    const thirdApplication = new ApplicationGenerator()
    rg.addApplication(thirdApplication, 'first-service')

    const output = await rg.prepare()

    assert.deepEqual(output, {
      targetDirectory,
      env: {
        PLT_SERVER_HOSTNAME: '127.0.0.1',
        PLT_SERVER_LOGGER_LEVEL: 'info',
        PLT_MANAGEMENT_API: 'true',
        PORT: 3043
      }
    })

    // should list only runtime files
    const runtimeFileList = rg.listFiles()
    assert.deepEqual(runtimeFileList, ['platformatic.json', '.env', '.env.sample'])

    // applications have correct target directory
    assert.equal(
      thirdApplication.targetDirectory,
      join(rg.targetDirectory, 'applications', thirdApplication.config.applicationName)
    )
  }
})

test('RuntimeGenerator - add applications to an existing folder (web/)', async t => {
  const targetDirectory = await mkdtemp(join(tmpdir(), 'platformatic-runtime-generator-'))
  t.after(async () => {
    await safeRemove(targetDirectory)
  })

  {
    const rg = new RuntimeGenerator({
      targetDirectory
    })

    rg.setConfig({
      autoload: 'web'
    })

    // adding one application
    const firstApplication = new ApplicationGenerator()
    rg.addApplication(firstApplication, 'first-service')

    // adding another application
    const secondApplication = new ApplicationGenerator()
    rg.addApplication(secondApplication, 'second-service')

    rg.setEntryPoint('first-service')

    rg.setConfig({
      port: 3043
    })

    await rg.prepare()
    await rg.writeFiles()
  }

  {
    const rg = new RuntimeGenerator({
      targetDirectory
    })

    // adding another application
    const thirdApplication = new ApplicationGenerator()
    rg.addApplication(thirdApplication, 'first-service')

    const output = await rg.prepare()

    assert.deepEqual(output, {
      targetDirectory,
      env: {
        PLT_SERVER_HOSTNAME: '127.0.0.1',
        PLT_SERVER_LOGGER_LEVEL: 'info',
        PLT_MANAGEMENT_API: 'true',
        PORT: 3043
      }
    })

    // should list only runtime files
    const runtimeFileList = rg.listFiles()
    assert.deepEqual(runtimeFileList, ['platformatic.json', '.env', '.env.sample'])

    // applications have correct target directory
    assert.equal(
      thirdApplication.targetDirectory,
      join(rg.targetDirectory, 'web', thirdApplication.config.applicationName)
    )
  }
})

test('WrappedGenerator - should create valid environment files', async t => {
  const root = await createTemporaryDirectory(t)

  await writeFile(join(root, '.env'), 'A=1', 'utf-8')

  const generator = new WrappedGenerator({ module: '@platformatic/runtime', targetDirectory: root })
  await generator.prepare()

  const env = generator.getFileObject('.env')
  const envSample = generator.getFileObject('.env.sample')

  assert.deepStrictEqual(env.contents.split(/\r?\n/), [
    'A=1',
    'PLT_SERVER_HOSTNAME=127.0.0.1',
    'PORT=3042',
    'PLT_SERVER_LOGGER_LEVEL=info',
    'PLT_MANAGEMENT_API=true'
  ])

  assert.deepStrictEqual(envSample.contents.split(/\r?\n/), [
    'PLT_SERVER_HOSTNAME=127.0.0.1',
    'PORT=3042',
    'PLT_SERVER_LOGGER_LEVEL=info',
    'PLT_MANAGEMENT_API=true'
  ])
})

test('should support adding env variables only to .env and not .env.sample', async t => {
  const root = await createTemporaryDirectory(t)

  await writeFile(join(root, '.env'), 'A=1', 'utf-8')

  const generator = new WrappedGenerator({ module: '@platformatic/runtime', targetDirectory: root })
  generator.addEnvVar('FOO', '1', { overwrite: false, default: true })
  generator.addEnvVar('FOO', 'A', { overwrite: true, default: false })
  await generator.prepare()

  const env = generator.getFileObject('.env')
  const envSample = generator.getFileObject('.env.sample')

  assert.deepStrictEqual(env.contents.split(/\r?\n/), [
    'A=1',
    'FOO=A',
    'PLT_SERVER_HOSTNAME=127.0.0.1',
    'PORT=3042',
    'PLT_SERVER_LOGGER_LEVEL=info',
    'PLT_MANAGEMENT_API=true'
  ])

  assert.deepStrictEqual(envSample.contents.split(/\r?\n/), [
    'FOO=1',
    'PLT_SERVER_HOSTNAME=127.0.0.1',
    'PORT=3042',
    'PLT_SERVER_LOGGER_LEVEL=info',
    'PLT_MANAGEMENT_API=true'
  ])
})

test('WrappedGenerator - should create a valid watt.json', async t => {
  const version = await getPlatformaticVersion()
  const root = await createTemporaryDirectory(t)

  const generator = new WrappedGenerator({ module: '@platformatic/runtime', targetDirectory: root })
  await generator.prepare()

  const wattJson = generator.getFileObject('watt.json')

  assert.deepStrictEqual(JSON.parse(wattJson.contents), {
    $schema: `https://schemas.platformatic.dev/@platformatic/runtime/${version}.json`,
    runtime: {
      logger: {
        level: '{PLT_SERVER_LOGGER_LEVEL}'
      },
      server: {
        hostname: '{PLT_SERVER_HOSTNAME}',
        port: '{PORT}'
      },
      managementApi: '{PLT_MANAGEMENT_API}'
    }
  })
})

test('WrappedGenerator - should create a valid package.json', async t => {
  const version = await getPlatformaticVersion()
  const root = await createTemporaryDirectory(t)

  await writeFile(
    join(root, 'package.json'),
    JSON.stringify(
      {
        scripts: {
          build: 'foo',
          other: 'bar'
        },
        dependencies: {
          something: '^1',
          platformatic: 'foo',
          '@platformatic/runtime': 'latest'
        },
        engines: {
          foo: 'bar',
          node: '14'
        },
        rest: 'FOO',
        devDependencies: {
          baz: '123'
        }
      },
      null,
      2
    ),
    'utf-8'
  )

  const generator = new WrappedGenerator({
    module: '@platformatic/runtime',
    targetDirectory: root
  })
  generator.setConfig({
    buildCommand: 'build',
    devCommand: 'dev'
  })
  await generator.prepare()

  const packageJson = generator.getFileObject('package.json')

  const expected = {
    name: basename(root),
    scripts: {
      build: 'foo',
      other: 'bar',
      dev: 'dev',
      start: 'platformatic start'
    },
    dependencies: {
      '@platformatic/runtime': `^${version}`,
      platformatic: `^${version}`,
      something: '^1',
      wattpm: `^${version}`
    },
    devDependencies: {
      baz: '123'
    },
    rest: 'FOO',
    engines: {
      foo: 'bar',
      node: '>=22.18.0'
    }
  }

  assert.deepStrictEqual(packageJson.contents.split(/\r?\n/), JSON.stringify(expected, null, 2).split(/\r?\n/))
})
