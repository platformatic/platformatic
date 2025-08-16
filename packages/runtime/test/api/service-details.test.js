'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { createRuntime } = require('../helpers.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

const platformaticVersion = require('../../package.json').version

test('should get service details', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const serviceDetails = await app.getServiceDetails('with-logger')
  assert.deepStrictEqual(serviceDetails, {
    id: 'with-logger',
    type: 'service',
    status: 'started',
    version: platformaticVersion,
    entrypoint: false,
    localUrl: 'http://with-logger.plt.local',
    dependencies: []
  })
})
