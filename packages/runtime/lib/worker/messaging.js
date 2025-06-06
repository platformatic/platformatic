'use strict'

const { withResolvers, executeWithTimeout, kTimeout } = require('@platformatic/utils')
const { ITC, generateResponse, sanitize } = require('@platformatic/itc')
const errors = require('../errors')
const { RoundRobinMap } = require('./round-robin-map')
const { kWorkersBroadcast, kITC } = require('./symbols')

const kPendingResponses = Symbol('plt.messaging.pendingResponses')

class MessagingITC extends ITC {
  #timeout
  #listener
  #closeResolvers
  #broadcastChannel
  #workers
  #sources

  constructor (id, runtimeConfig) {
    super({
      throwOnMissingHandler: true,
      name: `${id}-messaging`
    })

    this.#timeout = runtimeConfig.messagingTimeout
    this.#workers = new RoundRobinMap()
    this.#sources = new Set()

    // Start listening on the BroadcastChannel for the list of services
    this.#broadcastChannel = new BroadcastChannel(kWorkersBroadcast)
    this.#broadcastChannel.onmessage = this.#updateWorkers.bind(this)

    this.listen()
  }

  _setupListener (listener) {
    this.#listener = listener
  }

  handle (message, handler) {
    if (typeof message === 'object') {
      for (const [name, fn] of Object.entries(message)) {
        super.handle(name, fn)
      }
    } else {
      super.handle(message, handler)
    }
  }

  async send (service, name, message, options) {
    // Get the next worker for the service
    const worker = this.#workers.next(service)

    if (!worker) {
      throw new errors.MessagingError(service, 'No workers available')
    }

    if (!worker.channel) {
      // Use twice the value here as a fallback measure. The target handler in the main thread is forwarding
      // the request to the worker, using executeWithTimeout with the user set timeout value.
      const channel = await executeWithTimeout(
        globalThis[kITC].send('getWorkerMessagingChannel', { service: worker.service, worker: worker.worker }),
        this.#timeout * 2
      )

      /* c8 ignore next 3 - Hard to test */
      if (channel === kTimeout) {
        throw new errors.MessagingError(service, 'Timeout while waiting for a communication channel.')
      }

      worker.channel = channel
      this.#setupChannel(channel)

      channel[kPendingResponses] = new Map()
      channel.on('close', this.#handlePendingResponse.bind(this, channel))
    }

    const context = { ...options }
    context.channel = worker.channel
    context.service = worker.service
    context.trackResponse = true

    const response = await executeWithTimeout(super.send(name, message, context), this.#timeout)

    if (response === kTimeout) {
      throw new errors.MessagingError(service, 'Timeout while waiting for a response.')
    }

    return response
  }

  async addSource (channel) {
    this.#sources.add(channel)
    this.#setupChannel(channel)

    // This has been closed on the other side.
    // Pending messages will be silently discarded by Node (as postMessage does not throw) so we don't need to handle them.
    channel.on('close', () => {
      this.#sources.delete(channel)
    })
  }

  _send (request, context) {
    const { channel, transferList } = context

    if (context.trackResponse) {
      const service = context.service
      channel[kPendingResponses].set(request.reqId, { service, request })
    }

    channel.postMessage(sanitize(request, transferList), { transferList })
  }

  _createClosePromise () {
    const { promise, resolve, reject } = withResolvers()
    this.#closeResolvers = { resolve, reject }
    return promise
  }

  _close () {
    this.#closeResolvers.resolve()
    this.#broadcastChannel.close()

    for (const source of this.#sources) {
      source.close()
    }

    for (const worker of this.#workers.values()) {
      worker.channel?.close()
    }

    this.#sources.clear()
  }

  #setupChannel (channel) {
    // Setup the message for processing
    channel.on('message', event => {
      this.#listener(event, { channel })
    })
  }

  #updateWorkers (event) {
    // Gather all existing channels by thread, it will make them reusable
    const existingChannels = new Map()
    for (const source of this.#workers.values()) {
      existingChannels.set(source.thread, source.channel)
    }

    // Create a brand new map
    this.#workers = new RoundRobinMap()

    const instances = []
    for (const [service, workers] of event.data) {
      const count = workers.length
      const next = Math.floor(Math.random() * count)

      instances.push({ id: service, next, workers: count })

      for (let i = 0; i < count; i++) {
        const worker = workers[i]
        const channel = existingChannels.get(worker.thread)

        // Note i is not the worker index as in runtime, but the index in the list of current alive workers for the service
        this.#workers.set(`${service}:${i}`, { ...worker, channel })
      }
    }

    this.#workers.configure(instances)
  }

  #handlePendingResponse (channel) {
    for (const { service, request } of channel[kPendingResponses].values()) {
      this._emitResponse(
        generateResponse(
          request,
          new errors.MessagingError(service, 'The communication channel was closed before receiving a response.'),
          null
        )
      )
    }

    channel[kPendingResponses].clear()
  }
}

module.exports = { MessagingITC }
