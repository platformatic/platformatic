'use strict'

const { test } = require('node:test')
const { ok, equal } = require('node:assert')
const { tspl } = require('@matteo.collina/tspl')
const { version, dependencies } = require('../package.json')
const { getPlatformaticVersion, hasDependency, getDependencyVersion, checkForDependencies, getLatestNpmVersion } = require('../')
const { MockAgent, setGlobalDispatcher } = require('undici')

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
  equal(version, dependencies['@fastify/deepmerge'].replace('^', ''))
})

test('checkForDependencies missing dep', async t => {
  const currentPlatformaticVersion = require('../package.json').version
  const { match, equal } = tspl(t, { plan: 4 })

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
      match(msg, /Please run .+ to install types dependencies./)
      match(msg, new RegExp(`@platformatic/db@${currentPlatformaticVersion}`))
      match(msg, /foobar@1.42.0/)
    },
    error: (msg) => {
      equal(msg, 'Cannot find latest version on npm for package fakepackage')
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
    equal(latest, '1.2.3')
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
    equal(latest, null)
  }
})
