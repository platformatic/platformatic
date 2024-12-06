'use strict'

const RuntimeApiClient = require('./lib/runtime-api-client')
const { createCacheInterceptor } = require('./lib/caching')

module.exports = {
  RuntimeApiClient,
  createCacheInterceptor
}
