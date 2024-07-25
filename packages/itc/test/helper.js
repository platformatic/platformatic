'use strict'

const { randomUUID } = require('node:crypto')

function generateItcRequest (request) {
  return {
    type: 'PLT_ITC_REQUEST',
    reqId: randomUUID(),
    version: '1.0.0',
    name: 'test-command',
    data: { test: 'test-req-message' },
    ...request,
  }
}

function generateItcResponse (response) {
  return {
    type: 'PLT_ITC_RESPONSE',
    reqId: randomUUID(),
    version: '1.0.0',
    name: 'test-command',
    error: null,
    data: { test: 'test-req-message' },
    ...response,
  }
}

module.exports = {
  generateItcRequest,
  generateItcResponse,
}
