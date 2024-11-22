'use strict'

const { setGlobalDispatcher, Agent, request } = require('undici')

setGlobalDispatcher(new Agent({
  keepAliveMaxTimeout: 1,
  keepAliveTimeout: 1
}))

module.exports.request = request
