import { createDirectory, ensureLoggableError } from '@platformatic/foundation'
import { ITC } from '@platformatic/itc'
import { once } from 'node:events'
import { rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createRequire, register } from 'node:module'
import { platform, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { request } from 'undici'
import { WebSocketServer } from 'ws'
import { exitCodes } from '../errors.js'
import { ensureFileUrl } from '../utils.js'

export const isWindows = platform() === 'win32'

// In theory we could use the context.id to namespace even more, but due to
// UNIX socket length limitation on MacOS, we don't.
export function generateChildrenId (context) {
  return [process.pid, Date.now()].join('-')
}

export function getSocketPath (id) {
  let socketPath = null

  /* c8 ignore next 7 */
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
  #websocketServer
  #socketPath
  #clients
  #requests
  #currentSender
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
      name: 'child-manager'
    })

    this.#id = generateChildrenId(context)
    this.#loader = loader
    this.#context = context
    this.#scripts = scripts
    this.#originalNodeOptions = process.env.NODE_OPTIONS
    this.#logger = globalThis.platformatic.logger
    this.#server = createServer(this.#childProcessFetchHandler.bind(this))
    this.#socketPath ??= getSocketPath(this.#id)
    this.#clients = new Set()
    this.#requests = new Map()
  }

  async listen () {
    super.listen()

    if (!isWindows) {
      await createDirectory(dirname(this.#socketPath))
    }

    this.#websocketServer = new WebSocketServer({ server: this.#server })

    this.#websocketServer.on('connection', ws => {
      this.#clients.add(ws)

      ws.on('message', raw => {
        try {
          this.#currentSender = ws
          const message = JSON.parse(raw)
          this.#requests.set(message.reqId, ws)
          this.#listener(message)
        } catch (error) {
          this.#handleUnexpectedError(error, 'Handling a message failed.', exitCodes.MANAGER_MESSAGE_HANDLING_FAILED)
        } finally {
          this.#currentSender = null
        }
      })

      ws.on('close', () => {
        this.#clients.delete(ws)
      })

      /* c8 ignore next 7 */
      ws.on('error', error => {
        this.#handleUnexpectedError(
          error,
          'Error while communicating with the children process.',
          exitCodes.MANAGER_SOCKET_ERROR
        )
      })
    })

    return new Promise((resolve, reject) => {
      this.#server.listen({ path: this.#socketPath }, resolve).on('error', reject)
    })
  }

  async close () {
    if (this.#dataPath) {
      await rm(this.#dataPath, { force: true })
    }

    for (const client of this.#clients) {
      client.close()
      await once(client, 'close')
    }

    await this.#closeServer(this.#websocketServer)
    await this.#closeServer(this.#server)
    await super.close()
  }

  async inject () {
    await this.listen()

    // Serialize data into a JSON file for the stackable to use
    this.#dataPath = resolve(tmpdir(), 'platformatic', 'runtimes', `${this.#id}.json`)
    await createDirectory(dirname(this.#dataPath))

    // We write all the data to a JSON file
    await writeFile(
      this.#dataPath,
      JSON.stringify(
        {
          data: this.#context,
          loader: ensureFileUrl(this.#loader),
          scripts: this.#scripts.map(s => ensureFileUrl(s))
        },
        null,
        2
      ),
      'utf-8'
    )

    process.env.PLT_MANAGER_ID = this.#id

    const nodeOptions = process.env.NODE_OPTIONS ?? ''
    const childProcessInclude = `--import="${new URL('./child-process.js', import.meta.url)}"`

    let telemetryInclude = ''
    if (this.#context.telemetryConfig && this.#context.telemetryConfig.enabled !== false) {
      const require = createRequire(import.meta.url)
      const telemetryPath = require.resolve('@platformatic/telemetry')
      const openTelemetrySetupPath = join(telemetryPath, '..', 'lib', 'node-telemetry.js')
      telemetryInclude = `--import="${pathToFileURL(openTelemetrySetupPath)}"`
    }

    process.env.NODE_OPTIONS = `${telemetryInclude} ${childProcessInclude} ${nodeOptions}`.trim()
  }

  async eject () {
    process.env.NODE_OPTIONS = this.#originalNodeOptions
    process.env.PLT_MANAGER_ID = ''
  }

  getSocketPath () {
    return this.#socketPath
  }

  getClients () {
    return this.#clients
  }

  register () {
    Object.assign(globalThis.platformatic, this.#context)
    register(this.#loader, { data: this.#context })
  }

  emit (...args) {
    super.emit(...args, this.#currentSender)
  }

  send (client, name, message) {
    this.#currentClient = client
    return super.send(name, message)
  }

  notify (client, name, message) {
    this.#currentClient = client
    return super.notify(name, message)
  }

  _send (message, stringify = true) {
    if (!this.#currentClient) {
      this.#currentClient = this.#requests.get(message.reqId)
      this.#requests.delete(message.reqId)

      if (!this.#currentClient) {
        return
      }
    }

    this.#currentClient.send(stringify ? JSON.stringify(message) : message)
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

  async #childProcessFetchHandler (req, res) {
    const { url, headers } = req

    const requestOptions = { method: req.method, headers }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      requestOptions.body = req
    }

    try {
      const {
        statusCode,
        headers: responseHeaders,
        body
      } = await request(`http://${headers.host}${url ?? '/'}`, requestOptions)

      res.writeHead(statusCode, responseHeaders)
      body.pipe(res)
    } catch (error) {
      res.writeHead(502, { 'content-type': 'application/json' })
      res.end(JSON.stringify(ensureLoggableError(error)))
    }
  }

  #handleUnexpectedError (error, message, exitCode) {
    this.#logger.error({ err: ensureLoggableError(error) }, message)
    process.exit(exitCode)
  }

  #closeServer (server) {
    return new Promise((resolve, reject) => {
      if (!server || server.listening === false) {
        resolve()
        return
      }

      server.close(err => {
        if (err) {
          reject(err)
          return
        }

        resolve()
      })
    })
  }
}
