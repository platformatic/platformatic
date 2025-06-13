'use strict'

const { mkdtemp, rmdir, unlink, writeFile } = require('node:fs/promises')
const { join } = require('node:path')
const { tmpdir } = require('node:os')
const { test } = require('node:test')
const { ok, equal } = require('node:assert')
const { tspl } = require('@matteo.collina/tspl')
const { version, dependencies } = require('../package.json')
const { getPlatformaticVersion, hasDependency, getDependencyVersion, checkForDependencies, getLatestNpmVersion, getPackageManager } = require('../')
const { MockAgent, setGlobalDispatcher } = require('undici')
const semver = require('semver')

const mockAgent = new MockAgent()
setGlobalDispatcher(mockAgent)
mockAgent.disableNetConnect()
test('getPlatformaticVersion', async t => {
  const platformaticVersion = await getPlatformaticVersion()
  equal(platformaticVersion, version)
})

test('hasDependency', async t => {
  ok(hasDependency({ dependencies: { fastify: '1.0.0' } }, 'fastify'), 'has dependency')
  ok(!hasDependency({ dependencies: { express: '1.0.0' } }, 'fastify'), 'does not have dependency')
  ok(hasDependency({ devDependencies: { fastify: '1.0.0' } }, 'fastify'), 'has dev dependency')
})

test('getDependencyVersion', async t => {
  const version = await getDependencyVersion(require, '@fastify/deepmerge')
  const toMatch = dependencies['@fastify/deepmerge']
  equal(semver.satisfies(version, toMatch), true)
})

test('checkForDependencies missing dep', async t => {
  const currentPlatformaticVersion = require('../package.json').version
  const { match, equal } = tspl(t, { plan: 4 })

  mockAgent
    .get('https://registry.npmjs.org')
    .intercept({
      method: 'GET',
      path: '/fakepackage',
    })
    .reply(404, {})

  mockAgent
    .get('https://registry.npmjs.org')
    .intercept({
      method: 'GET',
      path: '/foobar',
    })
    .reply(200, {
      'dist-tags': {
        latest: '1.42.0',
      },
    })

  const logger = {
    warn: (msg) => {
      match(msg, /Please run .+ to install types dependencies./)
      match(msg, new RegExp(`@platformatic/db@${currentPlatformaticVersion}`))
      match(msg, /foobar@1.42.0/)
    },
    error: (msg) => {
      equal(msg, 'Cannot find latest version on npm for package fakepackage')
    },
  }

  const args = {}
  const config = {}
  const modules = ['@platformatic/db', 'fakepackage', 'foobar']

  await checkForDependencies(logger, args, require, config, modules)
})

test('check latest npm version', async (t) => {
  {
    mockAgent
      .get('https://registry.npmjs.org')
      .intercept({
        method: 'GET',
        path: '/foobar',
      })
      .reply(200, {
        'dist-tags': {
          latest: '1.2.3',
        },
      })
    const latest = await getLatestNpmVersion('foobar')
    equal(latest, '1.2.3')
  }
  {
    // returns null
    mockAgent
      .get('https://registry.npmjs.org')
      .intercept({
        method: 'GET',
        path: '/foobar',
      })
      .reply(404, {})

    const latest = await getLatestNpmVersion('foobar')
    equal(latest, null)
  }
})

test('getPackageManager', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'wattpm-tests-'))
  equal(getPackageManager('wrong'), 'npm', 'no packageManager entry in package.json nor lock files, default to npm')

  // from package.json
  await writeFile(join(tmpDir, 'package.json'), JSON.stringify({ packageManager: 'pnpm@1.2.3' }), 'utf-8')
  equal(getPackageManager(tmpDir), 'pnpm', 'packageManager entry in package.json')
  await unlink(join(tmpDir, 'package.json'))

  // from package-lock.json
  await writeFile(join(tmpDir, 'package-lock.json'), JSON.stringify({ packageManager: 'yarn' }), 'utf-8')
  equal(getPackageManager(tmpDir), 'npm', 'no packageManager entry in package.json, but found package-lock.json file')
  await unlink(join(tmpDir, 'package-lock.json'))

  // from yarn.lock
  const tmpYarnFile = join(tmpDir, 'yarn.lock')
  await writeFile(tmpYarnFile, '-')
  equal(getPackageManager(tmpDir), 'yarn', 'no packageManager entry in package.json, but found yarn.lock file')
  await unlink(tmpYarnFile)

  // from pnpm-lock.yaml
  const tmpPnpmFile = join(tmpDir, 'pnpm-lock.yaml')
  await writeFile(tmpPnpmFile, '-')
  equal(getPackageManager(tmpDir), 'pnpm', 'no packageManager entry in package.json, but found pnpm-lock.yaml file')
  await unlink(tmpPnpmFile)

  equal(getPackageManager(tmpDir), 'npm', 'no packageManager entry in package.json, no lock files, default to npm')

  await rmdir(tmpDir)
})
