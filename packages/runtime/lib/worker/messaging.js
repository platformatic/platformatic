import { executeWithTimeout, ensureLoggableError, kTimeout } from '@platformatic/foundation'
import { ITC, parseRequest, generateRequest, generateResponse, sanitize, errors } from '@platformatic/itc'
import { MessagingError } from '../errors.js'
import { RoundRobinMap } from './round-robin-map.js'
import { kITC, kWorkersBroadcast } from './symbols.js'

const kPendingResponses = Symbol('plt.messaging.pendingResponses')

export class MessagingITC extends ITC {
  #timeout
  #listener
  #closeResolvers
  #broadcastChannel
  #notificationsChannels
  #workers
  #sources
  #logger

  constructor (id, runtimeConfig, logger) {
    super({
      throwOnMissingHandler: true,
      name: `${id}-messaging`
    })

    this.#timeout = runtimeConfig.messagingTimeout
    this.#workers = new RoundRobinMap()
    this.#sources = new Set()

    // Start listening on the BroadcastChannel for the list of applications
    this.#broadcastChannel = new BroadcastChannel(kWorkersBroadcast)
    this.#broadcastChannel.onmessage = this.#updateWorkers.bind(this)

    this.#notificationsChannels = new Map()

    const notificationsChannel = new BroadcastChannel(`plt.messaging.notifications-${id}`)
    notificationsChannel.onmessage = this.#handleNotification.bind(this)
    this.#notificationsChannels.set(id, notificationsChannel)

    this.#logger = logger

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

  async send (application, name, message, options) {
    // Get the next worker for the application
    const worker = this.#workers.next(application)

    if (!worker) {
      throw new MessagingError(application, 'No workers available')
    }

    if (!worker.channel) {
      // Use twice the value here as a fallback measure. The target handler in the main thread is forwarding
      // the request to the worker, using executeWithTimeout with the user set timeout value.
      const channel = await executeWithTimeout(
        globalThis[kITC].send('getWorkerMessagingChannel', { application: worker.application, worker: worker.worker }),
        this.#timeout * 2
      )

      /* c8 ignore next 3 - Hard to test */
      if (channel === kTimeout) {
        throw new MessagingError(application, 'Timeout while waiting for a communication channel.')
      }

      worker.channel = channel
      this.#setupChannel(channel)

      channel[kPendingResponses] = new Map()
      channel.on('close', this.#handlePendingResponse.bind(this, channel))
    }

    const context = { ...options }
    context.channel = worker.channel
    context.application = worker.application
    context.trackResponse = true

    const response = await executeWithTimeout(super.send(name, message, context), this.#timeout)

    if (response === kTimeout) {
      throw new MessagingError(application, 'Timeout while waiting for a response.')
    }

    return response
  }

  notify (application, name, message) {
    const request = generateRequest(name, message)

    let channel = this.#notificationsChannels.get(application)
    if (!channel) {
      channel = new BroadcastChannel(`plt.messaging.notifications-${application}`)
      this.#notificationsChannels.set(application, channel)
    }

    channel.postMessage(sanitize(request))
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
      const application = context.application
      channel[kPendingResponses].set(request.reqId, { application, request })
    }

    channel.postMessage(sanitize(request, transferList), { transferList })
  }

  _createClosePromise () {
    const { promise, resolve, reject } = Promise.withResolvers()
    this.#closeResolvers = { resolve, reject }
    return promise
  }

  _close () {
    this.#closeResolvers.resolve()
    this.#broadcastChannel.close()

    for (const channel of this.#notificationsChannels.values()) {
      channel.close()
    }

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
    for (const [application, workers] of event.data) {
      const count = workers.length
      const next = Math.floor(Math.random() * count)

      instances.push({ id: application, next, workers: count })

      for (let i = 0; i < count; i++) {
        const worker = workers[i]
        const channel = existingChannels.get(worker.thread)

        // Note i is not the worker index as in runtime, but the index in the list of current alive workers for the application
        this.#workers.set(`${application}:${i}`, { ...worker, channel })
      }
    }

    this.#workers.configure(instances)
  }

  async #handleNotification (messageEvent) {
    let request
    try {
      request = parseRequest(messageEvent.data)
    } catch (err) {
      this.#logger.error({ err: ensureLoggableError(err) }, 'Failed to parse the notification message.')
      return
    }

    try {
      const handler = this.getHandler(request.name)
      if (!handler) {
        throw new errors.HandlerNotFoundError(request.name)
      }

      await handler(request.data)
    } catch (error) {
      this.#logger.error({ error }, `"Handler for the "${request.name}" message failed.`)
    }
  }

  #handlePendingResponse (channel) {
    for (const { application, request } of channel[kPendingResponses].values()) {
      this._emitResponse(
        generateResponse(
          request,
          new MessagingError(application, 'The communication channel was closed before receiving a response.'),
          null
        )
      )
    }

    channel[kPendingResponses].clear()
  }
}
