import createService from '../../src/service/create-service.mjs'
import { isFileAccessible } from '../../src/utils.mjs'
import { test, beforeEach, afterEach } from 'tap'
import { tmpdir } from 'os'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { parseEnv } from '../helper.mjs'

let tmpDir
let log = []
beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
})

afterEach(() => {
  log = []
  rmSync(tmpDir, { recursive: true, force: true })
})

const fakeLogger = {
  debug: msg => log.push(msg),
  info: msg => log.push(msg)
}

test('creates service with no typescript', async ({ end, equal, same, ok }) => {
  const params = {
    hostname: 'myhost',
    port: 6666,
    typescript: false
  }

  await createService(params, fakeLogger, tmpDir)

  const pathToServiceConfigFile = join(tmpDir, 'platformatic.service.json')
  const serviceConfigFile = readFileSync(pathToServiceConfigFile, 'utf8')
  const serviceConfig = JSON.parse(serviceConfigFile)
  const { server, plugin } = serviceConfig

  equal(server.hostname, '{PLT_SERVER_HOSTNAME}')
  equal(server.port, '{PORT}')

  const pathToDbEnvFile = join(tmpDir, '.env')
  const dbEnvFile = readFileSync(pathToDbEnvFile, 'utf8')
  const dbEnv = parseEnv(dbEnvFile)
  equal(dbEnv.PLT_SERVER_HOSTNAME, 'myhost')
  equal(dbEnv.PORT, '6666')

  const pathToDbEnvSampleFile = join(tmpDir, '.env.sample')
  const dbEnvSampleFile = readFileSync(pathToDbEnvSampleFile, 'utf8')
  const dbEnvSample = parseEnv(dbEnvSampleFile)
  equal(dbEnvSample.PLT_SERVER_HOSTNAME, 'myhost')
  equal(dbEnvSample.PORT, '6666')

  same(plugin, ['./plugins', './routes'])
  ok(isFileAccessible(join(tmpDir, 'plugins', 'examples.js')))
  ok(isFileAccessible(join(tmpDir, 'routes', 'root.js')))
})

test('creates project with configuration already present', async ({ end, equal, ok }) => {
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
