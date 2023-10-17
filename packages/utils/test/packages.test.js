'use strict'

const { test } = require('tap')
const { version, dependencies } = require('../package.json')
const { getPlatformaticVersion, hasDependency, getDependencyVersion, checkForDependencies, getLatestNpmVersion } = require('../')
const { MockAgent, setGlobalDispatcher } = require('undici')

const mockAgent = new MockAgent()
setGlobalDispatcher(mockAgent)
mockAgent.disableNetConnect()
test('getPlatformaticVersion', async t => {
  const platformaticVersion = await getPlatformaticVersion()
  t.equal(platformaticVersion, version)
})

test('hasDependency', async t => {
  if (hasDependency({ dependencies: { fastify: '1.0.0' } }, 'fastify')) {
    t.pass('has dependency')
  }

  if (!hasDependency({ dependencies: { express: '1.0.0' } }, 'fastify')) {
    t.pass('does not have dependency')
  }

  if (hasDependency({ devDependencies: { fastify: '1.0.0' } }, 'fastify')) {
    t.pass('has dependency')
  }
})

test('getDependencyVersion', async t => {
  const version = await getDependencyVersion(require, '@fastify/deepmerge')
  t.equal(version, dependencies['@fastify/deepmerge'].replace('^', ''))
})

test('checkForDependencies missing dep', async t => {
  const currentPlatformaticVersion = require('../package.json').version
  t.plan(4)

  mockAgent
    .get('https://registry.npmjs.org')
    .intercept({
      method: 'GET',
      path: '/fakepackage'
    })
    .reply(404, {})

  mockAgent
    .get('https://registry.npmjs.org')
    .intercept({
      method: 'GET',
      path: '/foobar'
    })
    .reply(200, {
      'dist-tags': {
        latest: '1.42.0'
      }
    })

  const logger = {
    warn: (msg) => {
      t.match(msg, /Please run .+ to install types dependencies./)
      t.match(msg, `@platformatic/db@${currentPlatformaticVersion}`)
      t.match(msg, 'foobar@1.42.0')
    },
    error: (msg) => {
      t.match(msg, 'Cannot find latest version on npm for package fakepackage')
    }
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
        path: '/foobar'
      })
      .reply(200, {
        'dist-tags': {
          latest: '1.2.3'
        }
      })
    const latest = await getLatestNpmVersion('foobar')
    t.equal(latest, '1.2.3')
  }
  {
    // returns null
    mockAgent
      .get('https://registry.npmjs.org')
      .intercept({
        method: 'GET',
        path: '/foobar'
      })
      .reply(404, {})

    const latest = await getLatestNpmVersion('foobar')
    t.equal(latest, null)
  }
})
