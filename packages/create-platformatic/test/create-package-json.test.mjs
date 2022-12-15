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

test('creates package.json file for db project', async ({ end, equal }) => {
  const version = '1.2.3'
  const fastifyVersion = '4.5.6'
  await createPackageJson('db', version, fastifyVersion, fakeLogger, tmpDir)
  equal(log, `${tmpDir}/package.json successfully created.`)
  const accessible = await isFileAccessible(join(tmpDir, 'package.json'))
  equal(accessible, true)
  const packageJson = JSON.parse(readFileSync(join(tmpDir, 'package.json')))
  equal(packageJson.scripts.start, 'platformatic db start')
  equal(packageJson.dependencies.platformatic, `^${version}`)
  equal(packageJson.devDependencies.fastify, `^${fastifyVersion}`)
})

test('creates package.json file for service project', async ({ end, equal }) => {
  const version = '1.2.3'
  const fastifyVersion = '4.5.6'
  await createPackageJson('service', version, fastifyVersion, fakeLogger, tmpDir)
  equal(log, `${tmpDir}/package.json successfully created.`)
  const accessible = await isFileAccessible(join(tmpDir, 'package.json'))
  equal(accessible, true)
  const packageJson = JSON.parse(readFileSync(join(tmpDir, 'package.json')))
  equal(packageJson.scripts.start, 'platformatic service start')
  equal(packageJson.dependencies.platformatic, `^${version}`)
  equal(packageJson.devDependencies.fastify, `^${fastifyVersion}`)
})

test('do not create package.json file because already present', async ({ end, equal }) => {
  const version = '1.2.3'
  const fastifyVersion = '4.5.6'
  const packagejson = join(tmpDir, 'package.json')
  writeFileSync(packagejson, 'TEST')
  await createPackageJson('db', version, fastifyVersion, fakeLogger, tmpDir)
  equal(log, `${tmpDir}/package.json found, skipping creation of package.json file.`)
})
