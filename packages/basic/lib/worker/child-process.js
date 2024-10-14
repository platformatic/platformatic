import { ITC } from '@platformatic/itc'
import { setupNodeHTTPTelemetry } from '@platformatic/telemetry'
import { createPinoWritable, ensureLoggableError } from '@platformatic/utils'
import { collectMetrics } from '@platformatic/metrics'
import { tracingChannel } from 'node:diagnostics_channel'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { register } from 'node:module'
import { platform, tmpdir } from 'node:os'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isMainThread } from 'node:worker_threads'
import pino from 'pino'
import { getGlobalDispatcher, setGlobalDispatcher } from 'undici'
import { WebSocket } from 'ws'
import { exitCodes } from '../errors.js'
import { importFile } from '../utils.js'
import { getSocketPath, isWindows } from './child-manager.js'

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
        },
      }
    })

    /* c8 ignore next */
    const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
    this.#socket = new WebSocket(`${protocol}${getSocketPath(process.env.PLT_MANAGER_ID)}`)
    this.#pendingMessages = []

    this.listen()
    this.#setupLogger()
    this.#setupTelemetry()
    this.#setupHandlers()
    this.#setupServer()
    this.#setupInterceptors()

    this.on('close', signal => {
      process.kill(process.pid, signal)
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

  async #collectMetrics ({ serviceId, metricsConfig }) {
    const { registry } = await collectMetrics(serviceId, metricsConfig)
    this.#metricsRegistry = registry
  }

  async #getMetrics ({ format } = {}) {
    if (!this.#metricsRegistry) return null

    const res = format === 'json'
      ? await this.#metricsRegistry.getMetricsAsJSON()
      : await this.#metricsRegistry.metrics()

    return res
  }

  #setupLogger () {
    // Since this is executed by user code, make sure we only override this in the main thread
    // The rest will be intercepted by the BaseStackable.
    if (isMainThread) {
      this.#logger = pino({
        level: 'info',
        name: globalThis.platformatic.id,
        transport: {
          target: new URL('./child-transport.js', import.meta.url).toString(),
          options: { id: globalThis.platformatic.id }
        }
      })

      Reflect.defineProperty(process, 'stdout', { value: createPinoWritable(this.#logger, 'info') })
      Reflect.defineProperty(process, 'stderr', { value: createPinoWritable(this.#logger, 'error', true) })
    } else {
      this.#logger = pino({ level: 'info', name: globalThis.platformatic.id })
    }
  }

  /* c8 ignore next 5 */
  #setupTelemetry () {
    if (globalThis.platformatic.telemetry) {
      setupNodeHTTPTelemetry(globalThis.platformatic.telemetry, this.#logger)
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
          options.port = typeof port === 'number' ? port : 0
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
  }

  #setupInterceptors () {
    setGlobalDispatcher(getGlobalDispatcher().compose(createInterceptor(this)))
  }

  #setupHandlers () {
    function handleUnhandled (type, err) {
      this.#logger.error(
        { err: ensureLoggableError(err) },
        `Child process for service ${globalThis.platformatic.id} threw an ${type}.`
      )

      // Give some time to the logger and ITC notifications to land before shutting down
      setTimeout(() => process.exit(exitCodes.PROCESS_UNHANDLED_ERROR), 100)
    }

    process.on('uncaughtException', handleUnhandled.bind(this, 'uncaught exception'))
    process.on('unhandledRejection', handleUnhandled.bind(this, 'unhandled rejection'))
  }
}

async function main () {
  const dataPath = resolve(tmpdir(), 'platformatic', 'runtimes', `${process.env.PLT_MANAGER_ID}.json`)
  const { data, loader, scripts } = JSON.parse(await readFile(dataPath))

  globalThis.platformatic = data

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

/* c8 ignore next 3 */
if (!isWindows || basename(process.argv.at(-1)) !== 'npm-prefix.js') {
  await main()
}
