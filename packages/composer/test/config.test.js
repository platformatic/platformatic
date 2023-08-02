'use strict'

const { test } = require('tap')
const { platformaticService } = require('@platformatic/service')
const { platformaticComposer } = require('..')

test('configManagerConfig.transformConfig', async (t) => {
  t.same(platformaticComposer.configManagerConfig.transformConfig, platformaticService.configManagerConfig.transformConfig)
})
