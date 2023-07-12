import { test, beforeEach, afterEach } from 'tap'
import { tmpdir } from 'os'
import { isFileAccessible } from '../src/utils.mjs'
import { createPackageJson } from '../src/create-package-json.mjs'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'

let log = ''
const fakeLogger = {
  debug: msg => { log = msg }
}

let tmpDir
beforeEach(() => {
  log = ''
  tmpDir = mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

test('creates package.json file for db project', async ({ equal }) => {
  const version = '1.2.3'
  const fastifyVersion = '4.5.6'
  await createPackageJson(version, fastifyVersion, fakeLogger, tmpDir, false)
  equal(log, `${join(tmpDir, 'package.json')} successfully created.`)
  const accessible = await isFileAccessible(join(tmpDir, 'package.json'))
  equal(accessible, true)
  const packageJson = JSON.parse(readFileSync(join(tmpDir, 'package.json')))
  equal(packageJson.scripts.start, 'platformatic start')
  equal(packageJson.scripts.build, undefined)
  equal(packageJson.dependencies.platformatic, `^${version}`)
  equal(packageJson.devDependencies.fastify, `^${fastifyVersion}`)
})

test('creates package.json file for service project', async ({ equal }) => {
  const version = '1.2.3'
  const fastifyVersion = '4.5.6'
  await createPackageJson(version, fastifyVersion, fakeLogger, tmpDir, false)
  equal(log, `${join(tmpDir, 'package.json')} successfully created.`)
  const accessible = await isFileAccessible(join(tmpDir, 'package.json'))
  equal(accessible, true)
  const packageJson = JSON.parse(readFileSync(join(tmpDir, 'package.json')))
  equal(packageJson.scripts.start, 'platformatic start')
  equal(packageJson.dependencies.platformatic, `^${version}`)
  equal(packageJson.devDependencies.fastify, `^${fastifyVersion}`)
})

test('do not create package.json file because already present', async ({ equal }) => {
  const version = '1.2.3'
  const fastifyVersion = '4.5.6'
  const packagejson = join(tmpDir, 'package.json')
  writeFileSync(packagejson, 'TEST')
  await createPackageJson(version, fastifyVersion, fakeLogger, tmpDir, false)
  equal(log, `${join(tmpDir, 'package.json')} found, skipping creation of package.json file.`)
})

test('creates package.json file with TS build', async ({ equal }) => {
  const version = '1.2.3'
  const fastifyVersion = '4.5.6'
  await createPackageJson(version, fastifyVersion, fakeLogger, tmpDir, true)
  equal(log, `${join(tmpDir, 'package.json')} successfully created.`)
  const accessible = await isFileAccessible(join(tmpDir, 'package.json'))
  equal(accessible, true)
  const packageJson = JSON.parse(readFileSync(join(tmpDir, 'package.json')))
  equal(packageJson.scripts.start, 'platformatic start')
  equal(packageJson.scripts.clean, 'rm -fr ./dist')
  equal(packageJson.scripts.build, 'platformatic compile')
  equal(packageJson.dependencies.platformatic, `^${version}`)
  equal(packageJson.devDependencies.fastify, `^${fastifyVersion}`)
})
