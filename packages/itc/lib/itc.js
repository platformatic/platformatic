'use strict'

const { randomUUID } = require('node:crypto')
const { EventEmitter, once } = require('node:events')
const errors = require('./errors.js')

const PLT_ITC_REQUEST_TYPE = 'PLT_ITC_REQUEST'
const PLT_ITC_RESPONSE_TYPE = 'PLT_ITC_RESPONSE'
const PLT_ITC_NOTIFICATION_TYPE = 'PLT_ITC_NOTIFICATION'
const PLT_ITC_UNHANDLED_ERROR_TYPE = 'PLT_ITC_UNHANDLED_ERROR'
const PLT_ITC_VERSION = '1.0.0'

class ITC extends EventEmitter {
  #requestEmitter
  #handlers
  #listening
  #handling
  #closePromise
  #closeAfterCurrentRequest

  constructor ({ port }) {
    super()

    this.port = port
    this.#requestEmitter = new EventEmitter()
    this.#handlers = new Map()
    this.#listening = false
    this.#handling = false
    this.#closeAfterCurrentRequest = false

    // Make sure the emitter handle a lot of listeners at once before raising a warning
    this.#requestEmitter.setMaxListeners(1e3)
  }

  async send (name, message) {
    if (!this.#listening) {
      throw new errors.SendBeforeListen()
    }

    const request = this.#generateRequest(name, message)

    this._send(request)

    const responsePromise = once(this.#requestEmitter, request.reqId).then(([response]) => response)

    const { error, data } = await Promise.race([responsePromise, this.#closePromise])

    if (error !== null) throw error
    return data
  }

  async notify (name, message) {
    this._send(this.#generateNotification(name, message))
  }

  handle (message, handler) {
    this.#handlers.set(message, handler)
  }

  listen () {
    if (this.#listening) {
      throw new errors.PortAlreadyListening()
    }
    this.#listening = true

    this._setupListener(message => {
      const messageType = message.type
      if (messageType === PLT_ITC_REQUEST_TYPE) {
        this.#handleRequest(message)
        return
      }
      if (messageType === PLT_ITC_RESPONSE_TYPE) {
        this.#handleResponse(message)
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

  _send (request) {
    this.port.postMessage(request)
  }

  _createClosePromise () {
    return once(this.port, 'close')
  }

  _close () {
    this.port.close()
  }

  async #handleRequest (raw) {
    let request = null
    let handler = null
    let response = null

    this.#handling = true

    try {
      request = this.#parseRequest(raw)
      handler = this.#handlers.get(request.name)

      if (handler === undefined) {
        throw new errors.HandlerNotFound(request.name)
      }

      const result = await handler(request.data)
      response = this.#generateResponse(request, null, result)
    } catch (error) {
      if (!request) {
        response = this.#generateUnhandledErrorResponse(error)
      } else if (!handler) {
        response = this.#generateResponse(request, error, null)
      } else {
        const failedError = new errors.HandlerFailed(error.message)
        failedError.handlerError = error
        // This is needed as the code might be lost when sending the message over the port
        failedError.handlerErrorCode = error.code

        response = this.#generateResponse(request, failedError, null)
      }
    } finally {
      this.#handling = false
    }

    this._send(response)

    if (this.#closeAfterCurrentRequest) {
      this.close()
    }
  }

  #parseRequest (request) {
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

  #handleResponse (response) {
    try {
      response = this.#parseResponse(response)
    } catch (error) {
      response = this.#generateUnhandledErrorResponse(error)
      this._send(response)
      return
    }

    const reqId = response.reqId
    this.#requestEmitter.emit(reqId, response)
  }

  #parseResponse (response) {
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

  #generateRequest (name, data) {
    if (typeof name !== 'string') {
      throw new errors.RequestNameIsNotString(name.toString())
    }

    if (typeof data === 'object') {
      data = this.#sanitize(data)
    }

    return {
      type: PLT_ITC_REQUEST_TYPE,
      version: PLT_ITC_VERSION,
      reqId: randomUUID(),
      name,
      data,
    }
  }

  #generateResponse (request, error, data) {
    return {
      type: PLT_ITC_RESPONSE_TYPE,
      version: PLT_ITC_VERSION,
      reqId: request.reqId,
      name: request.name,
      error,
      data,
    }
  }

  #generateNotification (name, data) {
    return {
      type: PLT_ITC_NOTIFICATION_TYPE,
      version: PLT_ITC_VERSION,
      name,
      data,
    }
  }

  #generateUnhandledErrorResponse (error) {
    return {
      type: PLT_ITC_UNHANDLED_ERROR_TYPE,
      version: PLT_ITC_VERSION,
      error,
      data: null,
    }
  }

  #sanitize (data) {
    const sanitizedObject = {}
    for (const key in data) {
      const value = data[key]
      const type = typeof value

      if (type === 'object') {
        sanitizedObject[key] = this.#sanitize(value)
        continue
      }

      if (type !== 'function' && type !== 'symbol') {
        sanitizedObject[key] = value
      }
    }
    return sanitizedObject
  }
}

module.exports = ITC
