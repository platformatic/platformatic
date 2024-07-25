'use strict'

const { randomUUID } = require('node:crypto')
const { EventEmitter, once } = require('node:events')
const errors = require('./errors.js')

const PLT_ITC_REQUEST_TYPE = 'PLT_ITC_REQUEST'
const PLT_ITC_RESPONSE_TYPE = 'PLT_ITC_RESPONSE'
const PLT_ITC_UNHANDLED_ERROR_TYPE = 'PLT_ITC_UNHANDLED_ERROR'
const PLT_ITC_VERSION = '1.0.0'

class ITC extends EventEmitter {
  #requestEmitter
  #handlers
  #listening
  #closePromise

  constructor ({ port }) {
    super()

    this.port = port
    this.#requestEmitter = new EventEmitter()
    this.#handlers = new Map()
    this.#listening = false
  }

  async send (name, message) {
    if (!this.#listening) {
      throw new errors.SendBeforeListen()
    }

    const request = this.#generateRequest(name, message)
    this.port.postMessage(request)

    const responsePromise = once(this.#requestEmitter, request.reqId)
      .then(([response]) => response)

    const { error, data } = await Promise.race([
      responsePromise,
      this.#closePromise,
    ])

    if (error !== null) throw error
    return data
  }

  handle (message, handler) {
    this.#handlers.set(message, handler)
  }

  listen () {
    if (this.#listening) {
      throw new errors.PortAlreadyListening()
    }
    this.#listening = true

    this.port.on('message', (message) => {
      const messageType = message.type
      if (messageType === PLT_ITC_REQUEST_TYPE) {
        this.#handleRequest(message)
        return
      }
      if (messageType === PLT_ITC_RESPONSE_TYPE) {
        this.#handleResponse(message)
        return
      }
      if (messageType === PLT_ITC_UNHANDLED_ERROR_TYPE) {
        this.emit('unhandledError', message.error)
      }
    })

    this.#closePromise = once(this.port, 'close').then(() => {
      this.#listening = false
      const error = new errors.MessagePortClosed()
      return { error, data: null }
    })
  }

  close () {
    this.port.close()
  }

  async #handleRequest (request) {
    let response = null

    try {
      request = this.#parseRequest(request)
    } catch (error) {
      response = this.#generateUnhandledErrorResponse(error)
      this.port.postMessage(response)
      return
    }

    try {
      const handler = this.#handlers.get(request.name)
      if (handler === undefined) {
        throw new errors.HandlerNotFound(request.name)
      }

      try {
        const result = await handler(request.data)
        response = this.#generateResponse(request, null, result)
      } catch (handlerError) {
        const error = new errors.HandlerFailed(handlerError.message)
        error.handlerError = handlerError
        throw error
      }
    } catch (error) {
      response = this.#generateResponse(request, error, null)
    }
    this.port.postMessage(response)
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
      this.port.postMessage(response)
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
