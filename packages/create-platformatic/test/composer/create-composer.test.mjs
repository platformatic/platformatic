import createComposer from '../../src/composer/create-composer.mjs'
import { test, beforeEach, afterEach } from 'tap'
import { tmpdir } from 'os'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import dotenv from 'dotenv'

const base = tmpdir()
let tmpDir
let log = []
beforeEach(() => {
  tmpDir = mkdtempSync(join(base, 'test-create-platformatic-'))
})

afterEach(() => {
  log = []
  rmSync(tmpDir, { recursive: true, force: true })
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
  const composerConfigFile = readFileSync(pathToComposerConfigFile, 'utf8')
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
})

test('creates project with configuration already present', async ({ ok }) => {
  const pathToComposerConfigFileOld = join(tmpDir, 'platformatic.composer.json')
  writeFileSync(pathToComposerConfigFileOld, JSON.stringify({ test: 'test' }))
  const params = {
    hostname: 'myhost',
    port: 6666
  }
  await createComposer(params, fakeLogger, tmpDir)
  ok(log.includes('Configuration file platformatic.composer.json found, skipping creation of configuration file.'))
})

test('creates composer in a runtime context', async ({ equal, same, ok }) => {
  const params = {
    hostname: 'myhost',
    port: 6666,
    typescript: false
  }

  const composedServices = ['service1', 'service2']
  await createComposer(params, fakeLogger, tmpDir, undefined, true, composedServices)

  const pathToComposerConfigFile = join(tmpDir, 'platformatic.composer.json')
  const composerConfigFile = readFileSync(pathToComposerConfigFile, 'utf8')
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
