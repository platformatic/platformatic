import createService from '../../src/service/create-service.mjs'
import { isFileAccessible } from '../../src/utils.mjs'
import { test, beforeEach, afterEach } from 'tap'
import { tmpdir } from 'os'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import dotenv from 'dotenv'
import Ajv from 'ajv'
import { schema } from '@platformatic/service'

let tmpDir
let log = []
beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
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

test('creates service with typescript', async ({ equal, same, ok }) => {
  const params = {
    hostname: 'myhost',
    port: 6666,
    typescript: true
  }

  await createService(params, fakeLogger, tmpDir)

  const pathToServiceConfigFile = join(tmpDir, 'platformatic.service.json')
  const serviceConfigFile = readFileSync(pathToServiceConfigFile, 'utf8')
  const serviceConfig = JSON.parse(serviceConfigFile)
  const ajv = new Ajv()
  ajv.addKeyword('resolvePath')
  const validate = ajv.compile(schema.schema)
  const isValid = validate(serviceConfig)
  equal(isValid, true)
  const { server, plugins } = serviceConfig

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

  same(plugins, { paths: ['./plugins', './routes'] })
  ok(await isFileAccessible(join(tmpDir, 'plugins', 'example.ts')))
  ok(await isFileAccessible(join(tmpDir, 'routes', 'root.ts')))
})

test('creates service with javascript', async ({ equal, same, ok }) => {
  const params = {
    hostname: 'myhost',
    port: 6666,
    typescript: false
  }

  await createService(params, fakeLogger, tmpDir)

  const pathToServiceConfigFile = join(tmpDir, 'platformatic.service.json')
  const serviceConfigFile = readFileSync(pathToServiceConfigFile, 'utf8')
  const serviceConfig = JSON.parse(serviceConfigFile)
  const { server, plugins } = serviceConfig

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

  same(plugins, { paths: ['./plugins', './routes'] })
  ok(await isFileAccessible(join(tmpDir, 'plugins', 'example.js')))
  ok(await isFileAccessible(join(tmpDir, 'routes', 'root.js')))
})

test('creates project with configuration already present', async ({ ok }) => {
  const pathToServiceConfigFileOld = join(tmpDir, 'platformatic.service.json')
  writeFileSync(pathToServiceConfigFileOld, JSON.stringify({ test: 'test' }))
  const params = {
    hostname: 'myhost',
    port: 6666
  }
  await createService(params, fakeLogger, tmpDir)
  ok(log.includes('Configuration file platformatic.service.json found, skipping creation of configuration file.'))
})

test('creates project with plugins already present', async ({ ok }) => {
  const pathToPlugins = join(tmpDir, 'plugins')
  mkdirSync(pathToPlugins)
  const params = {
    hostname: 'myhost'
  }
  await createService(params, fakeLogger, tmpDir)
  ok(log.includes('Plugins folder "plugins" found, skipping creation of plugins folder.'))
})

test('creates project with routes already present', async ({ ok }) => {
  const pathToPlugins = join(tmpDir, 'routes')
  mkdirSync(pathToPlugins)
  const params = {
    hostname: 'myhost'
  }
  await createService(params, fakeLogger, tmpDir)
  ok(log.includes('Routes folder "routes" found, skipping creation of routes folder.'))
})
