import { test, beforeEach, afterEach } from 'tap'
import { tmpdir } from 'os'
import { isFileAccessible } from '../src/utils.mjs'
import { createPackageJson } from '../src/create-package-json.mjs'
import { join } from 'path'
import { mkdtemp, readFile, rm } from 'fs/promises'

let log = ''
const fakeLogger = {
  debug: msg => { log = msg }
}

let tmpDir
beforeEach(async () => {
  log = ''
  tmpDir = await mkdtemp(join(tmpdir(), 'test-create-platformatic-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

test('creates package.json file for db project', async ({ equal }) => {
  const version = '1.2.3'
  const fastifyVersion = '4.5.6'
  const addTSBuild = false
  const scripts = {}
  const dependencies = {
    '@platformatic/db': `^${version}`
  }
  await createPackageJson(version, fastifyVersion, fakeLogger, tmpDir, addTSBuild, scripts, dependencies)
  equal(log, `${join(tmpDir, 'package.json')} successfully created.`)
  const accessible = await isFileAccessible(join(tmpDir, 'package.json'))
  equal(accessible, true)
  const packageJson = JSON.parse(await readFile(join(tmpDir, 'package.json'), 'utf8'))
  equal(packageJson.scripts.start, 'platformatic start')
  equal(packageJson.scripts.build, undefined)
  equal(packageJson.dependencies.platformatic, `^${version}`)
  equal(packageJson.dependencies['@platformatic/db'], `^${version}`)
  equal(packageJson.devDependencies.fastify, `^${fastifyVersion}`)
})

test('creates package.json file for service project', async ({ equal }) => {
  const version = '1.2.3'
  const fastifyVersion = '4.5.6'
  const addTSBuild = false
  await createPackageJson(version, fastifyVersion, fakeLogger, tmpDir, addTSBuild)
  equal(log, `${join(tmpDir, 'package.json')} successfully created.`)
  const accessible = await isFileAccessible(join(tmpDir, 'package.json'))
  equal(accessible, true)
  const packageJson = JSON.parse(await readFile(join(tmpDir, 'package.json'), 'utf8'))
  equal(packageJson.scripts.start, 'platformatic start')
  equal(packageJson.dependencies.platformatic, `^${version}`)
  equal(packageJson.devDependencies.fastify, `^${fastifyVersion}`)
})

test('creates package.json file with TS build', async ({ equal }) => {
  const version = '1.2.3'
  const fastifyVersion = '4.5.6'
  const addTSBuild = true
  await createPackageJson(version, fastifyVersion, fakeLogger, tmpDir, addTSBuild)
  equal(log, `${join(tmpDir, 'package.json')} successfully created.`)
  const accessible = await isFileAccessible(join(tmpDir, 'package.json'))
  equal(accessible, true)
  const packageJson = JSON.parse(await readFile(join(tmpDir, 'package.json'), 'utf8'))
  equal(packageJson.scripts.start, 'platformatic start')
  equal(packageJson.scripts.clean, 'rm -fr ./dist')
  equal(packageJson.scripts.build, 'platformatic compile')
  equal(packageJson.dependencies.platformatic, `^${version}`)
  equal(packageJson.devDependencies.fastify, `^${fastifyVersion}`)
})
