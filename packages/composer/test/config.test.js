'use strict'

const assert = require('assert/strict')
const { test } = require('node:test')
const { platformaticService } = require('@platformatic/service')
const { platformaticComposer } = require('..')

test('configManagerConfig.transformConfig', async (t) => {
  assert.deepEqual(
    platformaticComposer.configManagerConfig.transformConfig,
    platformaticService.configManagerConfig.transformConfig
  )
})
