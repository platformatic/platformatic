'use strict'

const { setGlobalDispatcher, Agent } = require('undici')

setGlobalDispatcher(new Agent({
  keepAliveMaxTimeout: 10,
  keepAliveTimeout: 10
}))
