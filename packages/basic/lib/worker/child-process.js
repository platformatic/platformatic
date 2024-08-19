import { ITC } from '@platformatic/itc'
import { createPinoWritable, DestinationWritable, withResolvers } from '@platformatic/utils'
import { tracingChannel } from 'node:diagnostics_channel'
import pino from 'pino'

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

    this.handle('kill', () => {
      this.close()
    })
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
}

globalThis[Symbol.for('plt.children.itc')] = new ChildProcess()
