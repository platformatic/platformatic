'use strict'

const { randomUUID } = require('node:crypto')
const { EventEmitter, once } = require('node:events')
const { Unpromise } = require('@watchable/unpromise')
const errors = require('./errors.js')

const PLT_ITC_REQUEST_TYPE = 'PLT_ITC_REQUEST'
const PLT_ITC_RESPONSE_TYPE = 'PLT_ITC_RESPONSE'
const PLT_ITC_NOTIFICATION_TYPE = 'PLT_ITC_NOTIFICATION'
const PLT_ITC_UNHANDLED_ERROR_TYPE = 'PLT_ITC_UNHANDLED_ERROR'
const PLT_ITC_VERSION = '1.0.0'

function parseRequest (request) {
  if (request.reqId === undefined) {
    throw new errors.MissingRequestReqId()
  }
  if (request.version !== PLT_ITC_VERSION) {
    throw new errors.InvalidRequestVersion(request.version)
  }
  if (request.name === undefined) {
    throw new errors.MissingRequestName()
  }
  return request
}

function parseResponse (response) {
  if (response.reqId === undefined) {
    throw new errors.MissingResponseReqId()
  }
  if (response.version !== PLT_ITC_VERSION) {
    throw new errors.InvalidResponseVersion(response.version)
  }
  if (response.name === undefined) {
    throw new errors.MissingResponseName()
  }
  return response
}

function generateRequest (name, data) {
  if (typeof name !== 'string') {
    throw new errors.RequestNameIsNotString(name.toString())
  }

  return {
    type: PLT_ITC_REQUEST_TYPE,
    version: PLT_ITC_VERSION,
    reqId: randomUUID(),
    name,
    data
  }
}

function generateResponse (request, error, data) {
  return {
    type: PLT_ITC_RESPONSE_TYPE,
    version: PLT_ITC_VERSION,
    reqId: request.reqId,
    name: request.name,
    error,
    data
  }
}

function generateNotification (name, data) {
  return {
    type: PLT_ITC_NOTIFICATION_TYPE,
    version: PLT_ITC_VERSION,
    name,
    data
  }
}

function generateUnhandledErrorResponse (error) {
  return {
    type: PLT_ITC_UNHANDLED_ERROR_TYPE,
    version: PLT_ITC_VERSION,
    error,
    data: null
  }
}

function sanitize (data, transferList) {
  if (!data || typeof data !== 'object' || transferList?.includes(data) || data instanceof Error) {
    return data
  }

  let sanitized

  if (Buffer.isBuffer(data) || data instanceof Uint8Array) {
    // This will convert as Uint8Array
    return data
  } else if (Array.isArray(data)) {
    sanitized = []

    for (const value of data) {
      const valueType = typeof value

      /* c8 ignore next 3 */
      if (valueType === 'function' || valueType === 'symbol') {
        continue
      }

      sanitized.push(value && typeof value === 'object' ? sanitize(value, transferList) : value)
    }
  } else {
    sanitized = {}

    for (const [key, value] of Object.entries(data)) {
      const valueType = typeof value

      if (valueType === 'function' || valueType === 'symbol') {
        continue
      }

      sanitized[key] = value && typeof value === 'object' ? sanitize(value, transferList) : value
    }
  }

  return sanitized
}

class ITC extends EventEmitter {
  #requestEmitter
  #handlers
  #listening
  #handling
  #closePromise
  #closeAfterCurrentRequest
  #throwOnMissingHandler
  #keepAlive
  #keepAliveCount

  constructor ({ port, handlers, throwOnMissingHandler, name }) {
    super()

    if (!name) {
      throw new errors.MissingName()
    }

    // The name property is useful only for debugging purposes.
    // Without it, it's impossible to know which "side" of the ITC is being used.
    this.name = name
    this.port = port
    this.#requestEmitter = new EventEmitter()
    this.#handlers = new Map()
    this.#listening = false
    this.#handling = false
    this.#closeAfterCurrentRequest = false
    this.#throwOnMissingHandler = throwOnMissingHandler ?? true

    // Make sure the emitter handle a lot of listeners at once before raising a warning
    this.#requestEmitter.setMaxListeners(1e3)

    /*
      There some contexts in which a message is sent and the event loop empties up while waiting for a response.
      For instance @platformatic/astro when doing build with custom commands.

      The interval below is immediately unref() after creation.
      Everytime a message is sent and awaiting for a response we ref() it.
      We unref() it again as soon as the response is received.
      This ensures the event loop stays up as intended.
    */
    /* c8 ignore next 4 */
    this.#keepAlive = setInterval(() => {
      // Debugging line used to know who is not closing the ITC
      // process._rawDebug('Keep alive', this.name, this.#keepAliveCount)
    }, 10000).unref()
    this.#keepAliveCount = 0

    // Register handlers provided with the constructor
    if (typeof handlers === 'object') {
      for (const [name, fn] of Object.entries(handlers)) {
        this.handle(name, fn)
      }
    }
  }

  getHandler (message) {
    return this.#handlers.get(message)
  }

  async send (name, message, options) {
    if (!this.#listening) {
      throw new errors.SendBeforeListen()
    }

    try {
      this._enableKeepAlive()

      const request = generateRequest(name, message)
      this._send(request, options)

      const responsePromise = once(this.#requestEmitter, request.reqId).then(([response]) => response)

      const { error, data } = await Unpromise.race([responsePromise, this.#closePromise])

      if (error !== null) throw error
      return data
    } finally {
      this._manageKeepAlive()
    }
  }

  async notify (name, message, options) {
    this._send(generateNotification(name, message), options)
  }

  handle (message, handler) {
    this.#handlers.set(message, handler)
  }

  listen () {
    if (this.#listening) {
      throw new errors.PortAlreadyListening()
    }
    this.#listening = true

    this._setupListener((message, context) => {
      context ??= {}

      const messageType = message.type
      if (messageType === PLT_ITC_REQUEST_TYPE) {
        this.#handleRequest(message, context)
        return
      }
      if (messageType === PLT_ITC_RESPONSE_TYPE) {
        this.#handleResponse(message, context)
        return
      }
      if (messageType === PLT_ITC_NOTIFICATION_TYPE) {
        this.emit(message.name, message.data)
      }
      if (messageType === PLT_ITC_UNHANDLED_ERROR_TYPE) {
        this.emit('unhandledError', message.error)
      }
    })

    this.#closePromise = this._createClosePromise().then(() => {
      this.#listening = false
      const error = new errors.MessagePortClosed()
      clearInterval(this.#keepAlive)
      this.#keepAliveCount = -1000
      return { error, data: null }
    })
  }

  close () {
    if (this.#handling) {
      this.#closeAfterCurrentRequest = true
      return
    }

    this._close()
  }

  _setupListener (listener) {
    this.port.on('message', listener)
  }

  _send (request, options) {
    const transferList = options?.transferList || []
    this.port.postMessage(sanitize(request, transferList), transferList)
  }

  _createClosePromise () {
    return once(this.port, 'close')
  }

  _close () {
    clearTimeout(this.#keepAlive)
    this.port?.close?.()
  }

  async #handleRequest (raw, context) {
    let request = null
    let handler = null
    let response = null

    this.#handling = true

    try {
      request = parseRequest(raw)
      handler = this.#handlers.get(request.name)

      if (handler) {
        const result = await handler(request.data, context)
        response = generateResponse(request, null, result)
      } else {
        if (this.#throwOnMissingHandler) {
          throw new errors.HandlerNotFound(request.name)
        }

        response = generateResponse(request, null)
      }
    } catch (error) {
      if (!request) {
        response = generateUnhandledErrorResponse(error)
      } else if (!handler) {
        response = generateResponse(request, error, null)
      } else {
        const failedError = new errors.HandlerFailed(error.message)
        failedError.handlerError = error
        // This is needed as the code might be lost when sending the message over the port
        failedError.handlerErrorCode = error.code

        response = generateResponse(request, failedError, null)
      }
    } finally {
      this.#handling = false
    }

    this._send(response, context)

    if (this.#closeAfterCurrentRequest) {
      this.close()
    }
  }

  #handleResponse (response, context) {
    try {
      response = parseResponse(response)
    } catch (error) {
      response = generateUnhandledErrorResponse(error)
      this._send(response, context)
      return
    }

    this._emitResponse(response)
  }

  _emitResponse (response) {
    this.#requestEmitter.emit(response.reqId, response)
  }

  _enableKeepAlive () {
    this.#keepAlive.ref()
    this.#keepAliveCount++
  }

  _manageKeepAlive () {
    this.#keepAliveCount--

    /* c8 ignore next 3 */
    if (this.#keepAliveCount > 0) {
      return
    }

    this.#keepAlive.unref()
    this.#keepAliveCount = 0
  }
}

module.exports = {
  ITC,
  parseRequest,
  parseResponse,
  generateRequest,
  generateResponse,
  generateNotification,
  generateUnhandledErrorResponse,
  sanitize
}
