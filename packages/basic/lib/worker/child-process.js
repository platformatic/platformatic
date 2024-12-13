import { ITC } from '@platformatic/itc'
import { client, collectMetrics } from '@platformatic/metrics'
import { createPinoWritable, ensureLoggableError, features } from '@platformatic/utils'
import diagnosticChannel, { tracingChannel } from 'node:diagnostics_channel'
import { EventEmitter, once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { ServerResponse } from 'node:http'
import { register } from 'node:module'
import { hostname, platform, tmpdir } from 'node:os'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isMainThread } from 'node:worker_threads'
import pino from 'pino'
import { Agent, setGlobalDispatcher } from 'undici'
import { WebSocket } from 'ws'
import { exitCodes } from '../errors.js'
import { importFile } from '../utils.js'
import { getSocketPath } from './child-manager.js'

const windowsNpmExecutables = ['npm-prefix.js', 'npm-cli.js']

function createInterceptor (itc) {
  return function (dispatch) {
    return async (opts, handler) => {
      let url = opts.origin
      if (!(url instanceof URL)) {
        url = new URL(opts.path, url)
      }

      // Other URLs are handled normally
      if (!url.hostname.endsWith('.plt.local')) {
        return dispatch(opts, handler)
      }

      const headers = {
        ...opts?.headers
      }

      delete headers.connection
      delete headers['transfer-encoding']
      headers.host = url.host

      const requestOpts = {
        ...opts,
        headers
      }
      delete requestOpts.dispatcher

      itc
        .send('fetch', requestOpts)
        .then(res => {
          if (res.rawPayload && !Buffer.isBuffer(res.rawPayload)) {
            res.rawPayload = Buffer.from(res.rawPayload.data)
          }

          const headers = []
          for (const [key, value] of Object.entries(res.headers)) {
            if (Array.isArray(value)) {
              for (const v of value) {
                headers.push(key)
                headers.push(v)
              }
            } else {
              headers.push(key)
              headers.push(value)
            }
          }

          handler.onHeaders(res.statusCode, headers, () => {}, res.statusMessage)
          handler.onData(res.rawPayload)
          handler.onComplete([])
        })
        .catch(e => {
          handler.onError(new Error(e.message))
        })

      return true
    }
  }
}

export class ChildProcess extends ITC {
  #listener
  #socket
  #child
  #logger
  #metricsRegistry
  #pendingMessages

  constructor () {
    super({
      throwOnMissingHandler: false,
      name: `${process.env.PLT_MANAGER_ID}-child-process`,
      handlers: {
        collectMetrics: (...args) => {
          return this.#collectMetrics(...args)
        },
        getMetrics: (...args) => {
          return this.#getMetrics(...args)
        }
      }
    })

    /* c8 ignore next */
    const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
    this.#socket = new WebSocket(`${protocol}${getSocketPath(process.env.PLT_MANAGER_ID)}`)
    this.#pendingMessages = []
    this.#metricsRegistry = new client.Registry()

    this.listen()
    this.#setupLogger()
    this.#setupHandlers()
    this.#setupServer()
    this.#setupInterceptors()

    this.on('close', () => {
      if (!globalThis.platformatic.events.emit('close')) {
        // No user event, just exit without errors
        process.exit(0)
      }
    })

    this.registerGlobals({
      setOpenapiSchema: this.setOpenapiSchema.bind(this),
      setGraphqlSchema: this.setGraphqlSchema.bind(this),
      setConnectionString: this.setConnectionString.bind(this),
      setBasePath: this.setBasePath.bind(this)
    })
  }

  _setupListener (listener) {
    this.#listener = listener

    this.#socket.on('open', () => {
      // Never hang the process on this socket.
      this.#socket._socket.unref()

      /* c8 ignore next 3 */
      for (const message of this.#pendingMessages) {
        this.#socket.send(message)
      }
    })

    this.#socket.on('message', message => {
      try {
        this.#listener(JSON.parse(message))
      } catch (error) {
        this.#logger.error({ err: ensureLoggableError(error) }, 'Handling a message failed.')
        process.exit(exitCodes.PROCESS_MESSAGE_HANDLING_FAILED)
      }
    })

    /* c8 ignore next 5 */
    this.#socket.on('error', error => {
      process._rawDebug(error)
      // There is nothing to log here as the connection with the parent thread is lost. Exit with a special code
      process.exit(exitCodes.PROCESS_SOCKET_ERROR)
    })
  }

  _send (message) {
    /* c8 ignore next 4 */
    if (this.#socket.readyState === WebSocket.CONNECTING) {
      this.#pendingMessages.push(JSON.stringify(message))
      return
    }

    this.#socket.send(JSON.stringify(message))
  }

  _createClosePromise () {
    return once(this.#socket, 'close')
  }

  /* c8 ignore next 3 */
  _close () {
    this.#socket.close()
  }

  async #collectMetrics ({ serviceId, workerId, metricsConfig }) {
    await collectMetrics(serviceId, workerId, metricsConfig, this.#metricsRegistry)
  }

  async #getMetrics ({ format } = {}) {
    const res =
      format === 'json' ? await this.#metricsRegistry.getMetricsAsJSON() : await this.#metricsRegistry.metrics()

    return res
  }

  #setupLogger () {
    // Since this is executed by user code, make sure we only override this in the main thread
    // The rest will be intercepted by the BaseStackable.
    const pinoOptions = {
      level: 'info',
      name: globalThis.platformatic.serviceId
    }

    if (typeof globalThis.platformatic.workerId !== 'undefined') {
      pinoOptions.base = {
        pid: process.pid,
        hostname: hostname(),
        worker: parseInt(globalThis.platformatic.workerId)
      }
    }

    if (isMainThread) {
      pinoOptions.transport = {
        target: new URL('./child-transport.js', import.meta.url).toString()
      }

      this.#logger = pino(pinoOptions)

      Reflect.defineProperty(process, 'stdout', { value: createPinoWritable(this.#logger, 'info') })
      Reflect.defineProperty(process, 'stderr', { value: createPinoWritable(this.#logger, 'error', true) })
    } else {
      this.#logger = pino(pinoOptions)
    }
  }

  #setupServer () {
    const subscribers = {
      asyncStart ({ options }) {
        // Unix socket, do nothing
        if (options.path) {
          return
        }

        const port = globalThis.platformatic.port
        const host = globalThis.platformatic.host

        if (port !== false) {
          const hasFixedPort = typeof port === 'number'
          options.port = hasFixedPort ? port : 0

          if (hasFixedPort && features.node.reusePort) {
            options.reusePort = true
          }
        }

        if (typeof host === 'string') {
          options.host = host
        }
      },
      asyncEnd: ({ server }) => {
        tracingChannel('net.server.listen').unsubscribe(subscribers)

        const address = server.address()

        // Unix socket, do nothing
        if (typeof address === 'string') {
          return
        }

        const { family, address: host, port } = address
        /* c8 ignore next */
        const url = new URL(family === 'IPv6' ? `http://[${host}]:${port}` : `http://${host}:${port}`).origin

        this.notify('url', url)
      },
      error: ({ error }) => {
        tracingChannel('net.server.listen').unsubscribe(subscribers)
        this.notify('error', error)
      }
    }

    tracingChannel('net.server.listen').subscribe(subscribers)

    const { isEntrypoint, runtimeBasePath, wantsAbsoluteUrls } = globalThis.platformatic
    if (isEntrypoint && runtimeBasePath && !wantsAbsoluteUrls) {
      stripBasePath(runtimeBasePath)
    }
  }

  #setupInterceptors () {
    const globalDispatcher = new Agent().compose(createInterceptor(this))
    setGlobalDispatcher(globalDispatcher)
  }

  #setupHandlers () {
    const errorLabel =
      typeof globalThis.platformatic.workerId !== 'undefined'
        ? `worker ${globalThis.platformatic.workerId} of the service "${globalThis.platformatic.serviceId}"`
        : `service "${globalThis.platformatic.serviceId}"`

    function handleUnhandled (type, err) {
      this.#logger.error({ err: ensureLoggableError(err) }, `Child process for the ${errorLabel} threw an ${type}.`)

      // Give some time to the logger and ITC notifications to land before shutting down
      setTimeout(() => process.exit(exitCodes.PROCESS_UNHANDLED_ERROR), 100)
    }

    process.on('uncaughtException', handleUnhandled.bind(this, 'uncaught exception'))
    process.on('unhandledRejection', handleUnhandled.bind(this, 'unhandled rejection'))
  }

  registerGlobals (globals) {
    globalThis.platformatic = Object.assign(globalThis.platformatic ?? {}, globals)
  }

  setOpenapiSchema (schema) {
    this.notify('openapiSchema', schema)
  }

  setGraphqlSchema (schema) {
    this.notify('graphqlSchema', schema)
  }

  setConnectionString (connectionString) {
    this.notify('connectionString', connectionString)
  }

  setBasePath (basePath) {
    this.notify('basePath', basePath)
  }
}

function stripBasePath (basePath) {
  const kBasePath = Symbol('kBasePath')

  diagnosticChannel.subscribe('http.server.request.start', ({ request, response }) => {
    if (request.url.startsWith(basePath)) {
      request.url = request.url.slice(basePath.length)

      if (request.url.charAt(0) !== '/') {
        request.url = '/' + request.url
      }

      response[kBasePath] = basePath
    }
  })

  const originWriteHead = ServerResponse.prototype.writeHead
  const originSetHeader = ServerResponse.prototype.setHeader

  ServerResponse.prototype.writeHead = function (statusCode, statusMessage, headers) {
    if (this[kBasePath] !== undefined) {
      if (headers === undefined && typeof statusMessage === 'object') {
        headers = statusMessage
        statusMessage = undefined
      }

      if (headers) {
        for (const key in headers) {
          if (key.toLowerCase() === 'location' && !headers[key].startsWith(basePath)) {
            headers[key] = basePath + headers[key]
          }
        }
      }
    }

    return originWriteHead.call(this, statusCode, statusMessage, headers)
  }

  ServerResponse.prototype.setHeader = function (name, value) {
    if (this[kBasePath]) {
      if (name.toLowerCase() === 'location' && !value.startsWith(basePath)) {
        value = basePath + value
      }
    }
    originSetHeader.call(this, name, value)
  }
}

async function main () {
  const executable = basename(process.argv[1] ?? '')
  if (!isMainThread || windowsNpmExecutables.includes(executable)) {
    return
  }

  const dataPath = resolve(tmpdir(), 'platformatic', 'runtimes', `${process.env.PLT_MANAGER_ID}.json`)
  const { data, loader, scripts } = JSON.parse(await readFile(dataPath))

  globalThis.platformatic = data
  globalThis.platformatic.events = new EventEmitter()

  if (data.root && isMainThread) {
    process.chdir(fileURLToPath(data.root))
  }

  if (loader) {
    register(loader, { data })
  }

  for (const script of scripts) {
    await importFile(script)
  }

  globalThis[Symbol.for('plt.children.itc')] = new ChildProcess()
}

await main()
