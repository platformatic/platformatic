import { randomUUID } from 'node:crypto'
import { EventEmitter, once } from 'node:events'
import {
  HandlerFailed,
  HandlerNotFound,
  InvalidRequestVersion,
  InvalidResponseVersion,
  MessagePortClosed,
  MissingName,
  MissingRequestName,
  MissingRequestReqId,
  MissingResponseName,
  MissingResponseReqId,
  PortAlreadyListening,
  RequestNameIsNotString,
  RequestTimeout,
  SendBeforeListen
} from './errors.js'

const PLT_ITC_REQUEST_TYPE = 'PLT_ITC_REQUEST'
const PLT_ITC_RESPONSE_TYPE = 'PLT_ITC_RESPONSE'
const PLT_ITC_NOTIFICATION_TYPE = 'PLT_ITC_NOTIFICATION'
const PLT_ITC_UNHANDLED_ERROR_TYPE = 'PLT_ITC_UNHANDLED_ERROR'
const PLT_ITC_BATCH_TYPE = 'PLT_ITC_BATCH'
const PLT_ITC_VERSION = '1.0.0'

// Request IDs only need to be unique among the peers of a port (or, for ChildManager, of a server).
// A random prefix chosen once per thread plus a counter keeps them unique without a randomUUID() per message.
const requestIdPrefix = randomUUID() + '-'
let requestIdCounter = 0

function nextRequestId () {
  return requestIdPrefix + ++requestIdCounter
}

export function parseRequest (request) {
  if (request.reqId === undefined) {
    throw new MissingRequestReqId()
  }
  if (request.version !== PLT_ITC_VERSION) {
    throw new InvalidRequestVersion(request.version)
  }
  if (request.name === undefined) {
    throw new MissingRequestName()
  }
  return request
}

export function parseResponse (response) {
  if (response.reqId === undefined) {
    throw new MissingResponseReqId()
  }
  if (response.version !== PLT_ITC_VERSION) {
    throw new InvalidResponseVersion(response.version)
  }
  if (response.name === undefined) {
    throw new MissingResponseName()
  }
  return response
}

export function generateRequest (name, data, meta) {
  if (typeof name !== 'string') {
    throw new RequestNameIsNotString(name.toString())
  }

  const request = {
    type: PLT_ITC_REQUEST_TYPE,
    version: PLT_ITC_VERSION,
    reqId: nextRequestId(),
    name,
    data
  }

  if (typeof meta !== 'undefined') {
    request.meta = meta
  }

  return request
}

export function generateResponse (request, error, data) {
  return {
    type: PLT_ITC_RESPONSE_TYPE,
    version: PLT_ITC_VERSION,
    reqId: request.reqId,
    name: request.name,
    error,
    data
  }
}

// Several requests and responses posted as one message. Each of them is handled as if it had been posted alone.
export function generateBatch (messages) {
  return {
    type: PLT_ITC_BATCH_TYPE,
    version: PLT_ITC_VERSION,
    messages
  }
}

export function generateNotification (name, data, meta) {
  const notification = {
    type: PLT_ITC_NOTIFICATION_TYPE,
    version: PLT_ITC_VERSION,
    name,
    data
  }

  if (typeof meta !== 'undefined') {
    notification.meta = meta
  }

  return notification
}

export function generateUnhandledErrorResponse (error) {
  return {
    type: PLT_ITC_UNHANDLED_ERROR_TYPE,
    version: PLT_ITC_VERSION,
    error,
    data: null
  }
}

function sanitizeError (error, transferList) {
  let needsSanitization = false

  for (const value of Object.values(error)) {
    const valueType = typeof value
    if (valueType === 'function' || valueType === 'symbol') {
      needsSanitization = true
      break
    }

    if (value && typeof value === 'object') {
      const sanitized = sanitizeValue(value, transferList)
      if (sanitized !== value) {
        needsSanitization = true
        break
      }
    }
  }

  if (!needsSanitization) {
    return error
  }

  // Build a plain object with all safe error properties.
  // We intentionally do NOT create a new Error() because @fastify/error instances
  // (used by avvio and ITC errors) go through structured clone as plain objects,
  // which preserves all enumerable own properties. A standard new Error() would
  // instead be cloned as an Error, silently dropping custom properties like code.
  const sanitized = {}
  if (error.message) sanitized.message = error.message
  if (error.name) sanitized.name = error.name
  if (error.stack) sanitized.stack = error.stack
  if (error.code) sanitized.code = error.code
  if (error.statusCode) sanitized.statusCode = error.statusCode

  for (const [key, value] of Object.entries(error)) {
    if (key === 'message' || key === 'stack' || key === 'name' || key === 'code' || key === 'statusCode') continue
    const valueType = typeof value
    if (valueType === 'function' || valueType === 'symbol') continue

    if (value && typeof value === 'object') {
      sanitized[key] = sanitizeValue(value, transferList)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

function sanitizeArray (data, transferList) {
  let sanitized = null

  for (let i = 0; i < data.length; i++) {
    const value = data[i]
    const valueType = typeof value

    if (valueType === 'function' || valueType === 'symbol') {
      if (sanitized === null) {
        sanitized = data.slice(0, i)
      }
      continue
    }

    let sanitizedValue = value
    if (valueType === 'object' && value !== null) {
      sanitizedValue = sanitizeValue(value, transferList)
      if (sanitizedValue !== value && sanitized === null) {
        sanitized = data.slice(0, i)
      }
    }

    if (sanitized !== null) {
      sanitized.push(sanitizedValue)
    }
  }

  return sanitized ?? data
}

function copyProperties (data, keys, end) {
  const copy = {}

  for (let i = 0; i < end; i++) {
    copy[keys[i]] = data[keys[i]]
  }

  return copy
}

function sanitizeObject (data, transferList) {
  // Object.keys rather than Object.entries: the latter allocates a [key, value] pair per property.
  const keys = Object.keys(data)
  let sanitized = null

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const value = data[key]
    const valueType = typeof value

    if (valueType === 'function' || valueType === 'symbol') {
      if (sanitized === null) {
        sanitized = copyProperties(data, keys, i)
      }
      continue
    }

    let sanitizedValue = value
    if (valueType === 'object' && value !== null) {
      sanitizedValue = sanitizeValue(value, transferList)
      if (sanitizedValue !== value && sanitized === null) {
        sanitized = copyProperties(data, keys, i)
      }
    }

    if (sanitized !== null) {
      sanitized[key] = sanitizedValue
    }
  }

  return sanitized ?? data
}

// transferList is either null or a non-empty array, so the common case skips the lookup.
function sanitizeValue (data, transferList) {
  if (!data || typeof data !== 'object' || (transferList !== null && transferList.includes(data))) {
    return data
  }

  if (Array.isArray(data)) {
    return sanitizeArray(data, transferList)
  }

  // Buffers, typed arrays and DataViews are cloned (or transferred) as they are, and so are dates:
  // the structured clone algorithm ignores their own properties.
  if (ArrayBuffer.isView(data) || data instanceof Date) {
    return data
  }

  if (data instanceof Error) {
    return sanitizeError(data, transferList)
  }

  return sanitizeObject(data, transferList)
}

export function sanitize (data, transferList) {
  return sanitizeValue(data, transferList?.length > 0 ? transferList : null)
}

// Posts a message on a MessagePort or a BroadcastChannel, sanitizing it first.
// With skipSanitize the message is posted as it is, which saves walking it. If it turns out to hold a value
// that can't be cloned, postMessage throws before anything is sent or transferred, so the message is sanitized
// and posted again.
export function postMessage (port, message, transferList, skipSanitize) {
  if (skipSanitize) {
    try {
      port.postMessage(message, transferList)
      return
    } catch (error) {
      if (error?.name !== 'DataCloneError') {
        throw error
      }
    }
  }

  port.postMessage(sanitize(message, transferList), transferList)
}

// The messages queued for a port by ITC.prototype._queueMessage.
const kQueuedMessages = Symbol('plt.itc.queuedMessages')

// When a response was posted as soon as it was ready, an error thrown by postMessage rejected the promise of the
// request handling, which nothing awaits. A queued response that fails to post is reported the same way: as an
// unhandled rejection. A queued request that fails to post fails its own send instead.
function reportUnhandled (error) {
  Promise.reject(error)
}

// After a batching period that queued nothing, which happens when requests come one at a time, this many messages
// are posted at once without starting a new period. A period costs a setImmediate, which would again find nothing
// to batch.
const kPassThroughAfterLoneMessage = 8

export class ITC extends EventEmitter {
  #waitingRequests
  #handlers
  #unsanitizedResponses
  #listening
  #handling
  #closedResponse
  #closeAfterCurrentRequest
  #throwOnMissingHandler
  #keepAlive
  #keepAliveCount
  #queuedPorts
  #batching
  #queuedInPeriod
  #passThrough
  #onTurnEnd

  constructor ({ port, handlers, throwOnMissingHandler, name }) {
    super()

    if (!name) {
      throw new MissingName()
    }

    // The name property is useful only for debugging purposes.
    // Without it, it's impossible to know which "side" of the ITC is being used.
    this.name = name
    this.port = port
    this.#waitingRequests = new Map()
    this.#handlers = new Map()
    this.#unsanitizedResponses = new Set()
    this.#listening = false
    this.#handling = false
    this.#closeAfterCurrentRequest = false
    this.#throwOnMissingHandler = throwOnMissingHandler ?? true
    this.#queuedPorts = []
    this.#batching = false
    this.#queuedInPeriod = false
    this.#passThrough = 0
    this.#onTurnEnd = this.#endTurn.bind(this)

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
      throw new SendBeforeListen()
    }

    let reqId
    let abortHandler
    let timeoutHandle
    const signal = options?.signal
    const timeout = options?.timeout

    try {
      this._enableKeepAlive()
      signal?.throwIfAborted()

      const request = generateRequest(name, message, options?.meta)
      const pending = Promise.withResolvers()
      reqId = request.reqId
      this.#waitingRequests.set(reqId, pending)

      if (this.#closedResponse) {
        pending.resolve(this.#closedResponse)
      }

      // The response, a close of the port, an abort and a timeout all settle the same promise:
      // the first one wins and the others are no-ops. No race is needed.
      if (signal) {
        abortHandler = () => {
          const error = signal.reason ?? new DOMException('This operation was aborted', 'AbortError')
          pending.resolve({ error, data: null })
        }

        signal.addEventListener('abort', abortHandler, { once: true })
      }

      if (timeout > 0) {
        timeoutHandle = setTimeout(() => {
          pending.resolve({ error: new RequestTimeout(name, timeout), data: null })
        }, timeout)
        timeoutHandle.unref()
      }

      this._send(request, options)

      const { error, data } = await pending.promise

      if (error !== null) throw error
      return data
    } finally {
      if (abortHandler) {
        signal.removeEventListener('abort', abortHandler)
      }

      if (timeoutHandle) {
        clearTimeout(timeoutHandle)
      }

      // Clean up the waiting requests map even if an error occurred
      this.#waitingRequests.delete(reqId)
      this._manageKeepAlive()

      if (reqId) {
        this._onRequestSettled?.(reqId, options)
      }
    }
  }

  notify (name, message, options) {
    this._send(generateNotification(name, message, options?.meta), options)
  }

  async process (name, message, context) {
    const request = generateRequest(name, message, context?.meta)
    const { error, data } = await this.#dispatchRequest(request, context)

    if (error !== null) throw error
    return data
  }

  handle (message, handler, options) {
    this.#handlers.set(message, handler)

    if (options?.sanitize === false) {
      this.#unsanitizedResponses.add(message)
    } else {
      this.#unsanitizedResponses.delete(message)
    }
  }

  listen () {
    if (this.#listening) {
      throw new PortAlreadyListening()
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
      if (messageType === PLT_ITC_BATCH_TYPE) {
        const messages = message.messages
        // A batch means the other side is busy: batch what this one posts back too, without a pass-through.
        this.#passThrough = 0
        for (let i = 0; i < messages.length; i++) {
          const entry = messages[i]
          if (entry.type === PLT_ITC_REQUEST_TYPE) {
            // Each request gets its own context: a handler can set properties on it, like transferList.
            this.#handleRequest(entry, { ...context })
          } else {
            this.#handleResponse(entry, context)
          }
        }
        return
      }
      if (messageType === PLT_ITC_NOTIFICATION_TYPE) {
        this.emit(message.name, message.data)
      }
      if (messageType === PLT_ITC_UNHANDLED_ERROR_TYPE) {
        this.emit('unhandledError', message.error)
      }
    })

    this.#closedResponse = null
    this._createClosePromise().then(
      () => {
        this.#listening = false
        clearInterval(this.#keepAlive)
        this.#keepAliveCount = -1000
        this.#settlePendingRequests({ error: new MessagePortClosed(), data: null })
      },
      error => {
        this.#settlePendingRequests({ error, data: null })
      }
    )
  }

  close () {
    if (this.#handling) {
      this.#closeAfterCurrentRequest = true
      return
    }

    // Post the messages still queued before the ports close.
    this.#flushQueues()
    this._close()
  }

  _setupListener (listener) {
    this.port.on('message', listener)
  }

  _send (request, options) {
    postMessage(this.port, request, options?.transferList || [], options?.sanitize === false)
  }

  // Posts the response to a request. A subclass can override it to call _queueMessage instead.
  _sendResponse (response, context, skipSanitize) {
    if (skipSanitize) {
      this._send(response, { ...context, sanitize: false })
    } else {
      this._send(response, context)
    }
  }

  // Posts a request or a response on port, batching it with the other messages for that port while the ITC is busy.
  // A subclass that calls this must call _flushQueue(port) before posting anything else on the port,
  // to keep the messages in order.
  //
  // The ITC is either idle or batching:
  // - idle: a message is posted at once, then the ITC switches to batching until the end of the event loop turn,
  //   which setImmediate marks: it runs after the I/O callbacks of the turn.
  // - batching: messages are queued per port. At the end of the turn the queue of each port is posted as one
  //   PLT_ITC_BATCH message, and the ITC stays in batching for the next turn. A turn that queued nothing ends
  //   batching.
  // A lone message is never delayed, and under load one postMessage per port and turn replaces one per message.
  _queueMessage (port, message, transferList, skipSanitize) {
    if (!this.#batching) {
      // Exactly as a message posted without batching: an error is thrown to the caller.
      postMessage(port, message, transferList || [], skipSanitize)

      if (this.#passThrough > 0) {
        this.#passThrough--
        return
      }

      this.#batching = true
      setImmediate(this.#onTurnEnd)
      return
    }

    // A message that must be sanitized is walked now, as it would be if posted at once.
    // The structured clone, which copies it, happens when the queue is flushed.
    if (!skipSanitize) {
      message = sanitize(message, transferList)
    }

    let queue = port[kQueuedMessages]
    if (queue === undefined) {
      queue = { messages: [], transferLists: [], transferList: [] }
      port[kQueuedMessages] = queue
    }

    if (queue.messages.length === 0) {
      this.#queuedPorts.push(port)
    }

    queue.messages.push(message)
    queue.transferLists.push(transferList)
    if (transferList?.length > 0) {
      queue.transferList.push(...transferList)
    }
  }

  // Posts the messages queued for port at once.
  _flushQueue (port) {
    if (port?.[kQueuedMessages]?.messages.length > 0) {
      this.#flushPort(port)
    }
  }

  #endTurn () {
    if (this.#queuedPorts.length > 0) {
      this.#flushQueues()
      this.#queuedInPeriod = true
      setImmediate(this.#onTurnEnd)
      return
    }

    this.#batching = false
    // A period that queued nothing had only the message that started it.
    this.#passThrough = this.#queuedInPeriod ? 0 : kPassThroughAfterLoneMessage
    this.#queuedInPeriod = false
  }

  #flushQueues () {
    const ports = this.#queuedPorts
    if (ports.length === 0) {
      return
    }

    this.#queuedPorts = []
    for (let i = 0; i < ports.length; i++) {
      this.#flushPort(ports[i])
    }
  }

  #flushPort (port) {
    const queue = port[kQueuedMessages]
    const { messages, transferLists, transferList } = queue

    // Also when the port was flushed already, by _flushQueue
    if (messages.length === 0) {
      return
    }

    queue.messages = []
    queue.transferLists = []
    queue.transferList = []

    if (messages.length === 1) {
      this.#postQueued(port, messages[0], transferLists[0])
      return
    }

    try {
      port.postMessage(generateBatch(messages), transferList)
    } catch {
      // A message can't be cloned. postMessage throws before posting or transferring anything,
      // so post the messages one by one: only that one fails, as it did when each was posted alone.
      for (let i = 0; i < messages.length; i++) {
        this.#postQueued(port, messages[i], transferLists[i])
      }
    }
  }

  #postQueued (port, message, transferList) {
    try {
      // Messages to be sanitized were sanitized when queued. Those that were not are sanitized only if
      // they can't be cloned as they are.
      postMessage(port, message, transferList || [], true)
    } catch (error) {
      if (message.type === PLT_ITC_REQUEST_TYPE) {
        this.#waitingRequests.get(message.reqId)?.resolve({ error, data: null })
      } else {
        reportUnhandled(error)
      }
    }
  }

  _createClosePromise () {
    return once(this.port, 'close')
  }

  _close () {
    clearTimeout(this.#keepAlive)
    this.port?.close?.()
  }

  async #handleRequest (raw, context) {
    // A handler registered with { sanitize: false } returns only cloneable data. Errors are always sanitized.
    // This is read in the same tick #dispatchRequest picks the handler, so registering the message again while
    // the handler runs doesn't change how its result is posted.
    const skipSanitize = this.#unsanitizedResponses.has(raw.name)
    const response = await this.#dispatchRequest(raw, context)

    this._sendResponse(response, context, skipSanitize && response.error === null)

    if (this.#closeAfterCurrentRequest) {
      this.close()
    }
  }

  async #dispatchRequest (raw, context) {
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
          throw new HandlerNotFound(request.name)
        }

        response = generateResponse(request, null)
      }
    } catch (error) {
      if (!request) {
        response = generateUnhandledErrorResponse(error)
      } else if (!handler) {
        response = generateResponse(request, error, null)
      } else {
        const failedError = new HandlerFailed(error.message)
        failedError.handlerError = error
        // This is needed as the code might be lost when sending the message over the port
        failedError.handlerErrorCode = error.code

        response = generateResponse(request, failedError, null)
      }
    } finally {
      this.#handling = false
    }

    return response
  }

  // Called once the port is closed: every request still waiting, and any sent later, gets this response.
  #settlePendingRequests (response) {
    this.#closedResponse = response

    for (const pending of this.#waitingRequests.values()) {
      pending.resolve(response)
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
    const pending = this.#waitingRequests.get(response.reqId)
    if (!pending) {
      return
    }

    pending.resolve(response)
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

export * as errors from './errors.js'
export * from './telemetry.js'
