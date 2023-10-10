import createComposer from '../../src/composer/create-composer.mjs'
import { test, beforeEach, afterEach } from 'tap'
import { tmpdir } from 'os'
import { join } from 'path'
import dotenv from 'dotenv'
import { mkdtemp, readFile, rm, stat } from 'fs/promises'

const base = tmpdir()
let tmpDir
let log = []
beforeEach(async () => {
  tmpDir = await mkdtemp(join(base, 'test-create-platformatic-'))
})

afterEach(async () => {
  log = []
  await rm(tmpDir, { recursive: true, force: true })
  process.env = {}
})

const fakeLogger = {
  debug: msg => log.push(msg),
  info: msg => log.push(msg)
}

test('creates composer', async ({ equal, same, ok }) => {
  const params = {
    hostname: 'myhost',
    port: 6666,
    typescript: false
  }

  await createComposer(params, fakeLogger, tmpDir)

  const pathToComposerConfigFile = join(tmpDir, 'platformatic.composer.json')
  const composerConfigFile = await readFile(pathToComposerConfigFile, 'utf8')
  const composerConfig = JSON.parse(composerConfigFile)
  const { server, composer } = composerConfig

  equal(server.hostname, '{PLT_SERVER_HOSTNAME}')
  equal(server.port, '{PORT}')

  const pathToDbEnvFile = join(tmpDir, '.env')
  dotenv.config({ path: pathToDbEnvFile })
  equal(process.env.PLT_SERVER_HOSTNAME, 'myhost')
  equal(process.env.PORT, '6666')
  process.env = {}

  const pathToDbEnvSampleFile = join(tmpDir, '.env.sample')
  dotenv.config({ path: pathToDbEnvSampleFile })
  equal(process.env.PLT_SERVER_HOSTNAME, 'myhost')
  equal(process.env.PORT, '6666')

  same(composer, {
    services: [{
      id: 'example',
      origin: '{PLT_EXAMPLE_ORIGIN}',
      openapi: {
        url: '/documentation/json'
      }
    }],
    refreshTimeout: 1000
  })

  // plugins and routes config is there
  same(composerConfig.plugins, {
    paths: [
      { path: './plugins', encapsulate: false },
      './routes'
    ]
  })
  // plugins and routes are created
  const directoriesToCheck = ['plugins', 'routes']
  for (const d of directoriesToCheck) {
    const meta = await stat(join(tmpDir, d))
    equal(meta.isDirectory(), true)
  }
})

test('creates composer in a runtime context', async ({ equal, same, ok }) => {
  const params = {
    isRuntimeContext: true,
    servicesToCompose: ['service1', 'service2'],
    hostname: 'myhost',
    port: 6666,
    typescript: false
  }

  await createComposer(params, fakeLogger, tmpDir, undefined)

  const pathToComposerConfigFile = join(tmpDir, 'platformatic.composer.json')
  const composerConfigFile = await readFile(pathToComposerConfigFile, 'utf8')
  const composerConfig = JSON.parse(composerConfigFile)
  const { server, composer } = composerConfig

  equal(server, undefined)

  const pathToEnvFile = join(tmpDir, '.env')
  dotenv.config({ path: pathToEnvFile })
  equal(process.env.PLT_SERVER_HOSTNAME, undefined)
  equal(process.env.PORT, undefined)
  process.env = {}

  const pathToEnvSampleFile = join(tmpDir, '.env.sample')
  dotenv.config({ path: pathToEnvSampleFile })
  equal(process.env.PLT_SERVER_HOSTNAME, undefined)
  equal(process.env.PORT, undefined)

  same(composer, {
    services: [
      {
        id: 'service1',
        openapi: {
          url: '/documentation/json',
          prefix: '/service1'
        }
      },
      {
        id: 'service2',
        openapi: {
          url: '/documentation/json',
          prefix: '/service2'
        }
      }
    ],
    refreshTimeout: 1000
  })
})
