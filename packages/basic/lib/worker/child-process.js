import { ITC } from '@platformatic/itc'
import { DestinationWritable, createPinoWritable } from '@platformatic/utils'
import { tracingChannel } from 'node:diagnostics_channel'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { register } from 'node:module'
import { platform, tmpdir } from 'node:os'
import { basename, resolve } from 'node:path'
import pino from 'pino'
import { getGlobalDispatcher, setGlobalDispatcher } from 'undici'
import { WebSocket } from 'ws'
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

class ChildProcessWritable extends DestinationWritable {
  #itc

  constructor (options) {
    const { itc, ...opts } = options

    super(opts)
    this.#itc = itc
  }

  _send (message) {
    this.#itc.send('log', JSON.stringify(message))
  }
}

class ChildProcess extends ITC {
  #listener
  #socket
  #child
  #logger
  #pendingMessages

  constructor () {
    super({ throwOnMissingHandler: false })

    const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
    this.#socket = new WebSocket(`${protocol}${getSocketPath(process.env.PLT_MANAGER_ID)}`)
    this.#pendingMessages = []

    this.listen()
    this.#setupLogger()
    this.#setupServer()
    this.#setupInterceptors()

    this.on('close', signal => {
      process.kill(process.pid, signal)
    })
  }

  _setupListener (listener) {
    this.#listener = listener

    this.#socket.on('open', () => {
      // Never hang the process due to this socket
      this.#socket._socket.unref()

      for (const message of this.#pendingMessages) {
        this.#socket.send(message)
      }
    })

    this.#socket.on('message', message => {
      this.#listener(JSON.parse(message))
    })

    this.#socket.on('error', () => {
      // There is nothing to log here as the connection with the parent thread is lost. Exit with a special code
      process.exit(2)
    })
  }

  _send (message) {
    if (this.#socket.readyState === WebSocket.CONNECTING) {
      this.#pendingMessages.push(JSON.stringify(message))
      return
    }

    this.#socket.send(JSON.stringify(message))
  }

  _createClosePromise () {
    return once(this.#socket, 'close')
  }

  _close () {
    this.#socket.close()
  }

  #setupLogger () {
    const destination = new ChildProcessWritable({ itc: this })
    this.#logger = pino(
      { level: 'info', name: globalThis.platformatic.id, ...globalThis.platformatic.logger },
      destination
    )

    Reflect.defineProperty(process, 'stdout', { value: createPinoWritable(this.#logger, 'info') })
    Reflect.defineProperty(process, 'stderr', { value: createPinoWritable(this.#logger, 'error') })
  }

  #setupServer () {
    const subscribers = {
      asyncStart ({ options }) {
        const port = globalThis.platformatic.port

        if (port !== false) {
          options.port = typeof port === 'number' ? port : 0
        }
      },
      asyncEnd: ({ server }) => {
        tracingChannel('net.server.listen').unsubscribe(subscribers)

        const { family, address, port } = server.address()
        const url = new URL(family === 'IPv6' ? `http://[${address}]:${port}` : `http://${address}:${port}`).origin

        this.notify('url', url)
      },
      error: error => {
        tracingChannel('net.server.listen').unsubscribe(subscribers)
        this.notify('error', error)
      }
    }

    tracingChannel('net.server.listen').subscribe(subscribers)
  }

  #setupInterceptors () {
    setGlobalDispatcher(getGlobalDispatcher().compose(createInterceptor(this)))
  }
}

async function main () {
  const dataPath = resolve(tmpdir(), 'platformatic', 'runtimes', `${process.env.PLT_MANAGER_ID}.json`)
  const { data, loader, scripts } = JSON.parse(await readFile(dataPath))

  globalThis.platformatic = data

  if (loader) {
    register(global.loader, { data })
  }

  for (const script of scripts) {
    await import(script)
  }

  globalThis[Symbol.for('plt.children.itc')] = new ChildProcess()
}

if (!isWindows || basename(process.argv.at(-1)) !== 'npm-prefix.js') {
  await main()
}
