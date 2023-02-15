'use strict'

const { setGlobalDispatcher, Agent, request } = require('undici')

setGlobalDispatcher(new Agent({
  keepAliveMaxTimeout: 10,
  keepAliveTimeout: 10
}))

module.exports.request = request
