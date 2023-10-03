import createService from '../../src/service/create-service.mjs'
import { isFileAccessible } from '../../src/utils.mjs'
import { test, beforeEach, afterEach } from 'tap'
import { tmpdir } from 'os'
import { readFile, writeFile, rm, mkdir, mkdtemp } from 'fs/promises'
import { join } from 'path'
import dotenv from 'dotenv'
import Ajv from 'ajv'
import { schema } from '@platformatic/service'

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
  info: msg => log.push(msg),
  warn: msg => log.push(msg)
}

test('creates service with typescript', async ({ equal, same, ok }) => {
  const params = {
    hostname: 'myhost',
    port: 6666,
    typescript: true
  }

  await createService(params, fakeLogger, tmpDir)

  const pathToServiceConfigFile = join(tmpDir, 'platformatic.service.json')
  const serviceConfigFile = await readFile(pathToServiceConfigFile, 'utf8')
  const serviceConfig = JSON.parse(serviceConfigFile)
  const ajv = new Ajv()
  ajv.addKeyword('resolvePath')
  const validate = ajv.compile(schema.schema)
  const isValid = validate(serviceConfig)
  equal(isValid, true)
  const { server, plugins } = serviceConfig

  equal(server.hostname, '{PLT_SERVER_HOSTNAME}')
  equal(server.port, '{PORT}')

  const pathToServiceEnvFile = join(tmpDir, '.env')
  dotenv.config({ path: pathToServiceEnvFile })
  equal(process.env.PLT_SERVER_HOSTNAME, 'myhost')
  equal(process.env.PORT, '6666')
  equal(process.env.PLT_TYPESCRIPT, 'true')

  process.env = {}

  const pathToServiceEnvSampleFile = join(tmpDir, '.env.sample')
  dotenv.config({ path: pathToServiceEnvSampleFile })
  equal(process.env.PLT_SERVER_HOSTNAME, 'myhost')
  equal(process.env.PORT, '6666')
  equal(process.env.PLT_TYPESCRIPT, 'true')

  same(plugins.paths, [{ path: './plugins', encapsulate: false }, './routes'])
  equal(plugins.typescript, '{PLT_TYPESCRIPT}')

  ok(await isFileAccessible(join(tmpDir, 'tsconfig.json')))
  ok(await isFileAccessible(join(tmpDir, 'plugins', 'example.ts')))
  ok(await isFileAccessible(join(tmpDir, 'routes', 'root.ts')))

  ok(await isFileAccessible(join(tmpDir, 'test', 'plugins', 'example.test.ts')))
  ok(await isFileAccessible(join(tmpDir, 'test', 'routes', 'root.test.ts')))
  ok(await isFileAccessible(join(tmpDir, 'test', 'helper.ts')))
})

test('creates service with javascript', async ({ equal, same, ok }) => {
  const params = {
    hostname: 'myhost',
    port: 6666,
    typescript: false
  }

  await createService(params, fakeLogger, tmpDir)

  const pathToServiceConfigFile = join(tmpDir, 'platformatic.service.json')
  const serviceConfigFile = await readFile(pathToServiceConfigFile, 'utf8')
  const serviceConfig = JSON.parse(serviceConfigFile)
  const { server, plugins } = serviceConfig

  equal(server.hostname, '{PLT_SERVER_HOSTNAME}')
  equal(server.port, '{PORT}')

  const pathToServiceEnvFile = join(tmpDir, '.env')
  dotenv.config({ path: pathToServiceEnvFile })
  equal(process.env.PLT_SERVER_HOSTNAME, 'myhost')
  equal(process.env.PORT, '6666')
  process.env = {}

  const pathToServiceEnvSampleFile = join(tmpDir, '.env.sample')
  dotenv.config({ path: pathToServiceEnvSampleFile })
  equal(process.env.PLT_SERVER_HOSTNAME, 'myhost')
  equal(process.env.PORT, '6666')

  same(plugins, { paths: [{ path: './plugins', encapsulate: false }, './routes'] })
  ok(await isFileAccessible(join(tmpDir, 'plugins', 'example.js')))
  ok(await isFileAccessible(join(tmpDir, 'routes', 'root.js')))

  ok(await isFileAccessible(join(tmpDir, 'test', 'plugins', 'example.test.js')))
  ok(await isFileAccessible(join(tmpDir, 'test', 'routes', 'root.test.js')))
  ok(await isFileAccessible(join(tmpDir, 'test', 'helper.js')))
})

test('creates project with configuration already present', async ({ ok }) => {
  const pathToServiceConfigFileOld = join(tmpDir, 'platformatic.service.json')
  await writeFile(pathToServiceConfigFileOld, JSON.stringify({ test: 'test' }))
  const params = {
    hostname: 'myhost',
    port: 6666
  }
  await createService(params, fakeLogger, tmpDir)
  ok(log.includes('Configuration file platformatic.service.json found, skipping creation of configuration file.'))
})

test('creates project with tsconfig already present', async ({ ok }) => {
  const pathToTsConfig = join(tmpDir, 'tsconfig.json')
  await writeFile(pathToTsConfig, 'test')
  const params = {
    hostname: 'myhost',
    port: 6666,
    typescript: true
  }
  await createService(params, fakeLogger, tmpDir)
  ok(log.includes(`Typescript configuration file ${pathToTsConfig} found, skipping creation of typescript configuration file.`))
})

test('creates project with plugins already present', async ({ ok }) => {
  const pathToPlugins = join(tmpDir, 'plugins')
  await mkdir(pathToPlugins)
  const params = {
    hostname: 'myhost'
  }
  await createService(params, fakeLogger, tmpDir)
  ok(log.includes('Plugins folder "plugins" found, skipping creation of plugins folder.'))
})

test('creates project with routes already present', async ({ ok }) => {
  const pathToPlugins = join(tmpDir, 'routes')
  await mkdir(pathToPlugins)
  const params = {
    hostname: 'myhost'
  }
  await createService(params, fakeLogger, tmpDir)
  ok(log.includes('Routes folder "routes" found, skipping creation of routes folder.'))
})

test('creates service in a runtime context', async ({ equal, same, ok, notOk }) => {
  const params = {
    isRuntimeContext: true,
    hostname: 'myhost',
    port: 6666,
    typescript: false,
    runtimeContext: {
      servicesNames: ['service-a', 'service-b'],
      envPrefix: 'SERVICE_PREFIX'
    },
    staticWorkspaceGitHubAction: true,
    dynamicWorkspaceGitHubAction: true
  }

  const serviceEnv = await createService(params, fakeLogger, tmpDir)
  same(serviceEnv, {
    SERVICE_PREFIX_PLT_SERVER_LOGGER_LEVEL: 'info',
    SERVICE_PREFIX_PORT: 6666,
    SERVICE_PREFIX_PLT_SERVER_HOSTNAME: 'myhost'
  })

  const pathToServiceConfigFile = join(tmpDir, 'platformatic.service.json')
  const serviceConfigFile = await readFile(pathToServiceConfigFile, 'utf8')
  const serviceConfig = JSON.parse(serviceConfigFile)
  const { server, plugins } = serviceConfig

  equal(server, undefined)

  const pathToServiceEnvFile = join(tmpDir, '.env')
  same(await readFile(pathToServiceEnvFile, 'utf8'), `
SERVICE_PREFIX_PLT_SERVER_LOGGER_LEVEL=info
SERVICE_PREFIX_PORT=6666
SERVICE_PREFIX_PLT_SERVER_HOSTNAME=myhost
`)
  const pathToServiceEnvSampleFile = join(tmpDir, '.env.sample')
  same(await readFile(pathToServiceEnvSampleFile, 'utf8'), `
SERVICE_PREFIX_PLT_SERVER_LOGGER_LEVEL=info
SERVICE_PREFIX_PORT=6666
SERVICE_PREFIX_PLT_SERVER_HOSTNAME=myhost
`)
  same(plugins, { paths: [{ path: './plugins', encapsulate: false }, './routes'] })
  // notOk(await isFileAccessible(join(tmpDir, '.env')))
  // notOk(await isFileAccessible(join(tmpDir, '.env.sample')))
  notOk(await isFileAccessible(join(tmpDir, '.github', 'workflows', 'platformatic-static-workspace-deploy.yml')))
  notOk(await isFileAccessible(join(tmpDir, '.github', 'workflows', 'platformatic-dynamic-workspace-deploy.yml')))
  ok(await isFileAccessible(join(tmpDir, 'plugins', 'example.js')))
  ok(await isFileAccessible(join(tmpDir, 'routes', 'root.js')))

  ok(await isFileAccessible(join(tmpDir, 'test', 'plugins', 'example.test.js')))
  ok(await isFileAccessible(join(tmpDir, 'test', 'routes', 'root.test.js')))
  ok(await isFileAccessible(join(tmpDir, 'test', 'helper.js')))
})
