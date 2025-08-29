import { randomUUID } from 'node:crypto'

export function generateItcRequest (request) {
  return {
    type: 'PLT_ITC_REQUEST',
    reqId: randomUUID(),
    version: '1.0.0',
    name: 'test-command',
    data: { test: 'test-req-message' },
    ...request
  }
}

export function generateItcResponse (response) {
  return {
    type: 'PLT_ITC_RESPONSE',
    reqId: randomUUID(),
    version: '1.0.0',
    name: 'test-command',
    error: null,
    data: { test: 'test-req-message' },
    ...response
  }
}
