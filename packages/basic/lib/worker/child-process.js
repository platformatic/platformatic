import { ITC } from '@platformatic/itc'
import { createPinoWritable, DestinationWritable, withResolvers } from '@platformatic/utils'
import { tracingChannel } from 'node:diagnostics_channel'
import pino from 'pino'
import { getGlobalDispatcher, setGlobalDispatcher } from 'undici'

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
        ...opts?.headers,
      }

      delete headers.connection
      delete headers['transfer-encoding']
      headers.host = url.host

      const requestOpts = {
        ...opts,
        headers,
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
  #child
  #logger

  constructor () {
    super({})

    this.listen()
    this.#setupLogger()
    this.#setupServer()
    this.#setupInterceptors()
  }

  _setupListener (listener) {
    this.#listener = listener
    process.on('message', this.#listener)
  }

  _send (request) {
    process.send(request)
  }

  _createClosePromise () {
    const { promise } = withResolvers()
    return promise
  }

  _close () {
    process.kill(process.pid, 'SIGKILL')
    this.#child.removeListener('message', this.#listener)
  }

  #setupLogger () {
    const destination = new ChildProcessWritable({ itc: this })
    this.#logger = pino({ level: 'info', ...globalThis.platformatic.logger }, destination)

    Reflect.defineProperty(process, 'stdout', { value: createPinoWritable(this.#logger, 'info') })
    Reflect.defineProperty(process, 'stderr', { value: createPinoWritable(this.#logger, 'error') })
  }

  #setupServer () {
    const subscribers = {
      asyncStart ({ options }) {
        options.port = 0
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
      },
    }

    tracingChannel('net.server.listen').subscribe(subscribers)
  }

  #setupInterceptors () {
    setGlobalDispatcher(getGlobalDispatcher().compose(createInterceptor(this)))
  }
}

globalThis[Symbol.for('plt.children.itc')] = new ChildProcess()
