import assert from 'assert'
import { tmpdir } from 'node:os'
import { test } from 'node:test'
import { join, dirname, relative } from 'node:path'
import { readFile, mkdtemp, cp, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import { cliPath } from './helper.mjs'

function urlDirname (url) {
  return dirname(fileURLToPath(url))
}

const env = {
  ...process.env
}
delete env.NODE_V8_COVERAGE

test('generate a default version config', async (t) => {
  const testDir = join(urlDirname(import.meta.url), '..', 'fixtures', 'init-version')
  const cwd = await mkdtemp(join(tmpdir(), 'test-init-version-'))

  const versionName = 'v1'
  const versionPrefix = `/${versionName}`

  await cp(testDir, cwd, { recursive: true })
  t.after(async () => { rm(cwd, { recursive: true, force: true }) })

  const configPath = join(cwd, 'platformatic.service.json')
  const configFile = await readFile(configPath, 'utf8')
  const config = JSON.parse(configFile)

  await execa('node', [cliPath, 'versions', 'bump'], { cwd, env })

  const openapiPath = join(cwd, 'versions', versionName, 'openapi.json')
  const openapiFile = await readFile(openapiPath, 'utf8')
  const openapi = JSON.parse(openapiFile)
  assert.ok(openapi.paths[versionPrefix + '/hello'])

  const v1ConfigFile = await readFile(configPath, 'utf8')
  const v1Config = JSON.parse(v1ConfigFile)

  assert.strictEqual(v1Config.plugins, undefined)
  assert.deepStrictEqual(v1Config.versions, {
    dir: 'versions',
    configs: [
      {
        version: versionName,
        openapi: {
          path: relative(cwd, openapiPath),
          prefix: versionPrefix
        },
        plugins: config.plugins
      }
    ]
  })
})

test('generate a version with a custom version name', async (t) => {
  const testDir = join(urlDirname(import.meta.url), '..', 'fixtures', 'init-version')
  const cwd = await mkdtemp(join(tmpdir(), 'test-init-version-'))

  await cp(testDir, cwd, { recursive: true })
  t.after(async () => { rm(cwd, { recursive: true, force: true }) })

  const versionName = 'v1'
  const versionPrefix = `/${versionName}`

  const configPath = join(cwd, 'platformatic.service.json')
  const configFile = await readFile(configPath, 'utf8')
  const config = JSON.parse(configFile)

  await execa('node', [cliPath, 'versions', 'bump', '-v', versionName], { cwd, env })

  const openapiPath = join(cwd, 'versions', versionName, 'openapi.json')
  const openapiFile = await readFile(openapiPath, 'utf8')
  const openapi = JSON.parse(openapiFile)
  assert.ok(openapi.paths[versionPrefix + '/hello'])

  const v1ConfigFile = await readFile(configPath, 'utf8')
  const v1Config = JSON.parse(v1ConfigFile)

  assert.strictEqual(v1Config.plugins, undefined)
  assert.deepStrictEqual(v1Config.versions, {
    dir: 'versions',
    configs: [
      {
        version: versionName,
        openapi: {
          path: relative(cwd, openapiPath),
          prefix: versionPrefix
        },
        plugins: config.plugins
      }
    ]
  })
})

test('generate a version with a custom version prefix', async (t) => {
  const testDir = join(urlDirname(import.meta.url), '..', 'fixtures', 'init-version')
  const cwd = await mkdtemp(join(tmpdir(), 'test-init-version-'))

  await cp(testDir, cwd, { recursive: true })
  t.after(async () => { rm(cwd, { recursive: true, force: true }) })

  const versionName = 'custom'
  const versionPrefix = '/custom-version-prefix'

  const configPath = join(cwd, 'platformatic.service.json')
  const configFile = await readFile(configPath, 'utf8')
  const config = JSON.parse(configFile)

  await execa('node', [
    cliPath, 'versions', 'bump',
    '--version', versionName,
    '--prefix', versionPrefix
  ], { cwd, env })

  const openapiPath = join(cwd, 'versions', versionName, 'openapi.json')
  const openapiFile = await readFile(openapiPath, 'utf8')
  const openapi = JSON.parse(openapiFile)
  assert.ok(openapi.paths[versionPrefix + '/hello'])

  const v1ConfigFile = await readFile(configPath, 'utf8')
  const v1Config = JSON.parse(v1ConfigFile)

  assert.strictEqual(v1Config.plugins, undefined)
  assert.deepStrictEqual(v1Config.versions, {
    dir: 'versions',
    configs: [
      {
        version: versionName,
        openapi: {
          path: relative(cwd, openapiPath),
          prefix: versionPrefix
        },
        plugins: config.plugins
      }
    ]
  })
})

test('add a slash to version prefix if it does not have it', async (t) => {
  const testDir = join(urlDirname(import.meta.url), '..', 'fixtures', 'init-version')
  const cwd = await mkdtemp(join(tmpdir(), 'test-init-version-'))

  await cp(testDir, cwd, { recursive: true })
  t.after(async () => { rm(cwd, { recursive: true, force: true }) })

  const versionName = 'custom'
  const versionPrefix = 'custom-version-prefix'

  const configPath = join(cwd, 'platformatic.service.json')
  const configFile = await readFile(configPath, 'utf8')
  const config = JSON.parse(configFile)

  await execa('node', [
    cliPath, 'versions', 'bump',
    '--version', versionName,
    '--prefix', versionPrefix
  ], { cwd, env })

  const openapiPath = join(cwd, 'versions', versionName, 'openapi.json')
  const openapiFile = await readFile(openapiPath, 'utf8')
  const openapi = JSON.parse(openapiFile)
  assert.ok(openapi.paths['/' + versionPrefix + '/hello'])

  const v1ConfigFile = await readFile(configPath, 'utf8')
  const v1Config = JSON.parse(v1ConfigFile)

  assert.strictEqual(v1Config.plugins, undefined)
  assert.deepStrictEqual(v1Config.versions, {
    dir: 'versions',
    configs: [
      {
        version: versionName,
        openapi: {
          path: relative(cwd, openapiPath),
          prefix: '/' + versionPrefix
        },
        plugins: config.plugins
      }
    ]
  })
})
