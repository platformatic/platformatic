import { ITC, generateNotification } from '@platformatic/itc'
import { createDirectory, errors } from '@platformatic/utils'
import { once } from 'node:events'
import { rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { register } from 'node:module'
import { platform, tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { workerData } from 'node:worker_threads'
import { request } from 'undici'
import { WebSocketServer } from 'ws'

export const isWindows = platform() === 'win32'

// In theory we could use the context.id to namespace even more, but due to
// UNIX socket length limitation on MacOS, we don't.
function generateChildrenId (context) {
  return [process.pid, Date.now()].join('-')
}

export function getSocketPath (id) {
  let socketPath = null
  if (platform() === 'win32') {
    socketPath = `\\\\.\\pipe\\plt-${id}`
  } else {
    // As stated in https://nodejs.org/dist/latest-v20.x/docs/api/net.html#identifying-paths-for-ipc-connections,
    // Node will take care of deleting the file for us
    socketPath = resolve(tmpdir(), 'platformatic', 'runtimes', `${id}.socket`)
  }

  return socketPath
}

export class ChildManager extends ITC {
  #id
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
  #originalNodeOptions
  #dataPath

  constructor (opts) {
    let { loader, context, scripts, handlers, ...itcOpts } = opts

    context ??= {}
    scripts ??= []

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

    this.#id = generateChildrenId(context)
    this.#loader = loader
    this.#context = context
    this.#scripts = scripts
    this.#originalNodeOptions = process.env.NODE_OPTIONS
    this.#logger = globalThis.platformatic.logger
    this.#server = createServer()
    this.#socketPath ??= getSocketPath(this.#id)
    this.#clients = new Set()
    this.#requests = new Map()
  }

  async listen () {
    super.listen()

    if (!isWindows) {
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

  async close (signal) {
    await rm(this.#dataPath)

    for (const client of this.#clients) {
      this.#currentClient = client
      this._send(generateNotification('close', signal))
    }

    super.close()
  }

  async inject () {
    await this.listen()

    // Serialize data into a JSON file for the stackable to use
    this.#dataPath = resolve(tmpdir(), 'platformatic', 'runtimes', `${this.#id}.json`)
    await createDirectory(dirname(this.#dataPath))

    // We write all the data to a JSON file
    await writeFile(
      this.#dataPath,
      JSON.stringify({ data: this.#context, loader: this.loader, scripts: this.#scripts }, null, 2),
      'utf-8'
    )

    process.env.PLT_MANAGER_ID = this.#id
    process.env.NODE_OPTIONS =
      `--import="${new URL('./child-process.js', import.meta.url)}" ${process.env.NODE_OPTIONS ?? ''}`.trim()
  }

  async eject () {
    process.env.NODE_OPTIONS = this.#originalNodeOptions
    process.env.PLT_MANAGER_ID = ''
  }

  register () {
    register(this.#loader, { data: this.#context })
  }

  send (client, name, message) {
    this.#currentClient = client
    super.send(name, message)
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
