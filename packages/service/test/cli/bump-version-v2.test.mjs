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

test('bump a new version', async (t) => {
  const testDir = join(urlDirname(import.meta.url), '..', 'fixtures', 'bump-version')
  const cwd = await mkdtemp(join(tmpdir(), 'test-bump-version-'))

  const versionName = 'v2'
  const versionPrefix = `/${versionName}`

  await cp(testDir, cwd, { recursive: true })
  t.after(async () => { rm(cwd, { recursive: true, force: true }) })

  const configPath = join(cwd, 'platformatic.service.json')
  const v1ConfigFile = await readFile(configPath, 'utf8')
  const v1Config = JSON.parse(v1ConfigFile)

  await execa('node', [cliPath, 'versions', 'bump', '-v', versionName], { cwd, env })

  const openapiPath = join(cwd, 'versions', versionName, 'openapi.json')
  const openapiFile = await readFile(openapiPath, 'utf8')
  const openapi = JSON.parse(openapiFile)
  assert.ok(openapi.paths[versionPrefix + '/hello'])

  const v2ConfigFile = await readFile(configPath, 'utf8')
  const v2Config = JSON.parse(v2ConfigFile)

  assert.strictEqual(v2Config.plugins, undefined)
  assert.deepStrictEqual(v2Config.versions, {
    dir: 'versions',
    configs: [
      {
        version: v1Config.versions.configs[0].version,
        openapi: v1Config.versions.configs[0].openapi
      },
      {
        version: versionName,
        openapi: {
          path: relative(cwd, openapiPath),
          prefix: versionPrefix
        },
        plugins: v1Config.versions.configs[0].plugins
      }
    ]
  })
})

test('bump a new version with a custom version prefix', async (t) => {
  const testDir = join(urlDirname(import.meta.url), '..', 'fixtures', 'bump-version')
  const cwd = await mkdtemp(join(tmpdir(), 'test-bump-version-'))

  const versionName = 'v2'
  const versionPrefix = '/custom'

  await cp(testDir, cwd, { recursive: true })
  t.after(async () => { rm(cwd, { recursive: true, force: true }) })

  const configPath = join(cwd, 'platformatic.service.json')
  const v1ConfigFile = await readFile(configPath, 'utf8')
  const v1Config = JSON.parse(v1ConfigFile)

  await execa('node', [
    cliPath, 'versions', 'bump',
    '--version', versionName,
    '--prefix', versionPrefix
  ], { cwd, env })

  const openapiPath = join(cwd, 'versions', versionName, 'openapi.json')
  const openapiFile = await readFile(openapiPath, 'utf8')
  const openapi = JSON.parse(openapiFile)
  assert.ok(openapi.paths[versionPrefix + '/hello'])

  const v2ConfigFile = await readFile(configPath, 'utf8')
  const v2Config = JSON.parse(v2ConfigFile)

  assert.strictEqual(v2Config.plugins, undefined)
  assert.deepStrictEqual(v2Config.versions, {
    dir: 'versions',
    configs: [
      {
        version: v1Config.versions.configs[0].version,
        openapi: v1Config.versions.configs[0].openapi
      },
      {
        version: versionName,
        openapi: {
          path: relative(cwd, openapiPath),
          prefix: versionPrefix
        },
        plugins: v1Config.versions.configs[0].plugins
      }
    ]
  })
})

test('fails if version is not specified', async (t) => {
  const testDir = join(urlDirname(import.meta.url), '..', 'fixtures', 'bump-version')
  const cwd = await mkdtemp(join(tmpdir(), 'test-bump-version-'))

  await cp(testDir, cwd, { recursive: true })
  t.after(async () => { rm(cwd, { recursive: true, force: true }) })

  try {
    await execa('node', [cliPath, 'versions', 'bump'], { cwd, env })
  } catch (err) {
    assert.strictEqual(err.exitCode, 1)
    assert.ok(
      err.stdout.includes('ERROR: Version not specified. Use --version option to specify a version.')
    )
  }
})

test('fails if version is already exists', async (t) => {
  const testDir = join(urlDirname(import.meta.url), '..', 'fixtures', 'bump-version')
  const cwd = await mkdtemp(join(tmpdir(), 'test-bump-version-'))

  await cp(testDir, cwd, { recursive: true })
  t.after(async () => { rm(cwd, { recursive: true, force: true }) })

  try {
    await execa('node', [cliPath, 'versions', 'bump', '--version', 'v1'], { cwd, env })
  } catch (err) {
    assert.strictEqual(err.exitCode, 1)
    assert.ok(err.stdout.includes('Version v1 already exists.'))
  }
})
