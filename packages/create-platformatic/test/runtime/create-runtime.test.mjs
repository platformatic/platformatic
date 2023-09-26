import createRuntime from '../../src/runtime/create-runtime.mjs'
import { test, beforeEach, afterEach } from 'tap'
import { tmpdir } from 'os'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

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

test('creates runtime', async ({ equal, same, ok }) => {
  const params = {
    servicesDir: 'services',
    entrypoint: 'foobar'
  }

  await createRuntime(params, fakeLogger, tmpDir, undefined)

  const pathToRuntimeConfigFile = join(tmpDir, 'platformatic.runtime.json')
  const runtimeConfigFile = readFileSync(pathToRuntimeConfigFile, 'utf8')
  const runtimeConfig = JSON.parse(runtimeConfigFile)

  delete runtimeConfig.$schema

  same(runtimeConfig, {
    entrypoint: 'foobar',
    allowCycles: false,
    hotReload: true,
    autoload: {
      path: 'services',
      exclude: ['docs']
    }
  })
})

test('with a full path for autoload', async ({ equal, same, ok }) => {
  const params = {
    servicesDir: join(tmpDir, 'services'),
    entrypoint: 'foobar'
  }

  await createRuntime(params, fakeLogger, tmpDir, undefined)

  const pathToRuntimeConfigFile = join(tmpDir, 'platformatic.runtime.json')
  const runtimeConfigFile = readFileSync(pathToRuntimeConfigFile, 'utf8')
  const runtimeConfig = JSON.parse(runtimeConfigFile)

  delete runtimeConfig.$schema

  same(runtimeConfig, {
    entrypoint: 'foobar',
    allowCycles: false,
    hotReload: true,
    autoload: {
      path: 'services',
      exclude: ['docs']
    }
  })
})

test('creates project with configuration already present', async ({ ok }) => {
  const params = {
    entrypoint: 'foobar'
  }

  const pathToRuntimeConfigFileOld = join(tmpDir, 'platformatic.runtime.json')
  writeFileSync(pathToRuntimeConfigFileOld, JSON.stringify({ test: 'test' }))
  await createRuntime(params, fakeLogger, tmpDir, 'foobar')
  ok(log.includes('Configuration file platformatic.runtime.json found, skipping creation of configuration file.'))
})
