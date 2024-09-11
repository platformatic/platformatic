import { ITC, generateNotification } from '@platformatic/itc'
import { createDirectory, errors } from '@platformatic/utils'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { register } from 'node:module'
import { platform, tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { workerData } from 'node:worker_threads'
import { request } from 'undici'
import { WebSocketServer } from 'ws'

function createSocketPath (context) {
  const id = context.id
  const pid = process.pid

  let socketPath = null
  if (platform() === 'win32') {
    socketPath = `\\\\.\\pipe\\platformatic-service-${id}-${pid}`
  } else {
    // As stated in https://nodejs.org/dist/latest-v20.x/docs/api/net.html#identifying-paths-for-ipc-connections,
    // Node will take care of deleting the file for us
    socketPath = resolve(tmpdir(), 'platformatic', 'runtimes', `service-${id}-${pid}.socket`)
  }

  return socketPath
}

export class ChildManager extends ITC {
  #loader
  #context
  #scripts
  #logger
  #server
  #socketPath
  #clients
  #requests
  #currentClient
  #listener
  #injectedNodeOptions
  #originalNodeOptions

  constructor (opts) {
    let { loader, context, scripts, handlers, skipProcessManager, ...itcOpts } = opts

    context ??= {}
    context.socketPath ??= createSocketPath(context)

    scripts ??= []
    if (!skipProcessManager) {
      scripts.push(new URL('./child-process.js', import.meta.url))
    }

    super({
      ...itcOpts,
      handlers: {
        log: message => {
          return this.#log(message)
        },
        fetch: request => {
          return this.#fetch(request)
        },
        ...itcOpts.handlers
      }
    })

    this.#logger = globalThis.platformatic.logger
    this.#server = createServer()
    this.#socketPath = context.socketPath
    this.#clients = new Set()
    this.#requests = new Map()
    this.#init(loader, context, scripts)
    this.#listen().catch(error => {
      this.#logger.error({ error: errors.ensureLoggableError(error) }, 'Cannot start child manager socket.')
    })
  }

  inject () {
    process.env.NODE_OPTIONS = this.#injectedNodeOptions
  }

  eject () {
    process.env.NODE_OPTIONS = this.#originalNodeOptions
  }

  register () {
    register(this.#loader, { data: this.#context })
  }

  send (client, name, message) {
    this.#currentClient = client
    super.send(name, message)
  }

  close (signal) {
    for (const client of this.#clients) {
      this.#currentClient = client
      this._send(generateNotification('close', signal))
    }

    super.close()
  }

  _send (message) {
    if (!this.#currentClient) {
      this.#currentClient = this.#requests.get(message.reqId)
      this.#requests.delete(message.reqId)

      if (!this.#currentClient) {
        return
      }
    }

    this.#currentClient.send(JSON.stringify(message))
    this.#currentClient = null
  }

  _setupListener (listener) {
    this.#listener = listener
  }

  _createClosePromise () {
    return once(this.#server, 'exit')
  }

  _close () {
    this.#server.close()
  }

  #init (loader, context, scripts) {
    this.#loader = loader
    this.#context = context
    this.#originalNodeOptions = process.env.NODE_OPTIONS

    this.#injectedNodeOptions = [
      `--import="data:text/javascript,globalThis.platformatic=${JSON.stringify(context).replaceAll('"', '\\"')};"`,
      loader
        ? `--import="data:text/javascript,import { register} from 'node:module';register('${loader}',{ data: globalThis.platformatic });"`
        : undefined,
      ...(scripts ?? []).map(s => `--import=${s}`),
      process.env.NODE_OPTIONS ?? ''
    ]
      .filter(i => i)
      .join(' ')
  }

  async #listen () {
    super.listen()

    if (platform() !== 'win32') {
      await createDirectory(dirname(this.#socketPath))
    }

    const wssServer = new WebSocketServer({ server: this.#server })

    wssServer.on('connection', ws => {
      this.#clients.add(ws)

      ws.on('message', raw => {
        const message = JSON.parse(raw)

        this.#requests.set(message.reqId, ws)
        this.#listener(message)
      })

      ws.on('close', () => {
        this.#clients.delete(ws)
      })

      ws.on('error', error => {
        this.#logger.error(
          { error: errors.ensureLoggableError(error) },
          'Error while communicating with the children process.'
        )
        process.exit(1)
      })
    })

    return new Promise((resolve, reject) => {
      this.#server.listen({ path: this.#socketPath }, resolve).on('error', reject)
    })
  }

  #log (message) {
    const messages = []

    for (const raw of JSON.parse(message).logs) {
      const log = JSON.parse(raw)

      for (const line of log.raw.split('\n')) {
        messages.push(JSON.stringify({ ...log, raw: line }))
      }
    }

    workerData.loggingPort.postMessage({ logs: messages })
  }

  async #fetch (opts) {
    const { statusCode, headers, body } = await request(opts)

    const rawPayload = Buffer.from(await body.arrayBuffer())
    const payload = rawPayload.toString()

    return { statusCode, headers, body: payload, payload, rawPayload }
  }
}
