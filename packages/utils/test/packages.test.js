'use strict'

const { test } = require('tap')
const { version, dependencies } = require('../package.json')
const { getPlatformaticVersion, hasDependency, getDependencyVersion, checkForDependencies } = require('../')

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

test('checkForDependencies', async t => {
  const logger = {}
  const args = {}
  const config = {}
  const modules = ['@fastify/deepmerge']

  await checkForDependencies(logger, args, require, config, modules)
})

test('checkForDependencies missing dep', async t => {
  t.plan(1)
  const logger = {
    warn: (msg) => {
      t.match(msg, /Please run .+ to install types dependencies./)
    }
  }

  const args = {}
  const config = {}
  const modules = ['express']

  await checkForDependencies(logger, args, require, config, modules)
})
