import { randomUUID } from 'node:crypto'
import { ITC } from '../lib/index.js'

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

// An ITC that queues its responses, as MessagingITC does, and counts the messages it posts.
export class BatchingITC extends ITC {
  constructor (options) {
    super(options)

    // The messages posted, without the attempts that threw
    this.posted = []
    const postMessage = this.port.postMessage
    this.port.postMessage = (message, transferList) => {
      postMessage.call(this.port, message, transferList)
      this.posted.push(message)
    }
  }

  _send (message, options) {
    this._flushQueue(this.port)
    super._send(message, options)
  }

  _sendResponse (response, context, skipSanitize) {
    this._queueMessage(this.port, response, context.transferList, skipSanitize)
  }
}

// An ITC that queues its requests too, as MessagingITC does.
export class QueueingITC extends BatchingITC {
  _send (message, options) {
    this._queueMessage(this.port, message, options?.transferList, options?.sanitize === false)
  }
}
