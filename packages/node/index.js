import {
  BaseStackable,
  createServerListener,
  getServerUrl,
  importFile,
  injectViaRequest,
  transformConfig
} from '@platformatic/basic'
import { ConfigManager } from '@platformatic/config'
import inject from 'light-my-request'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { Server } from 'node:http'
import { resolve as pathResolve, resolve } from 'node:path'
import { packageJson, schema } from './lib/schema.js'

const validFields = [
  'main',
  'exports',
  'exports',
  'exports#node',
  'exports#import',
  'exports#require',
  'exports#default',
  'exports#.#node',
  'exports#.#import',
  'exports#.#require',
  'exports#.#default'
]

const validFilesBasenames = ['index', 'main', 'app', 'application', 'server', 'start', 'bundle', 'run', 'entrypoint']

// Paolo: This is kinda hackish but there is no better way. I apologize.
function isFastify (app) {
  return Object.getOwnPropertySymbols(app).some(s => s.description === 'fastify.state')
}

export class NodeStackable extends BaseStackable {
  #entrypoint
  #hadEntrypointField
  #module
  #app
  #server
  #dispatcher
  #isFastify

  constructor (options, root, configManager, entrypoint, hadEntrypointField) {
    super('nodejs', packageJson.version, options, root, configManager)
    this.#entrypoint = entrypoint
    this.#hadEntrypointField = hadEntrypointField
  }

  async start ({ listen }) {
    // Make this idempotent
    if (this.url) {
      return this.url
    }

    // Listen if entrypoint
    if (this.#app && listen) {
      await this._listen()
      return this.url
    }

    // Require the application
    if (!this.#hadEntrypointField) {
      this.logger.warn(
        `The service ${this.id} had no valid entrypoint defined in the package.json file. Falling back to the file ${this.#entrypoint}.`
      )
    }

    // The server promise must be created before requiring the entrypoint even if it's not going to be used
    // at all. Otherwise there is chance we miss the listen event.
    const serverPromise = createServerListener()
    this.#module = await importFile(pathResolve(this.root, this.#entrypoint))
    this.#module = this.#module.default || this.#module

    // Deal with application
    if (typeof this.#module.build === 'function') {
      // We have build function, this Stackable will not use HTTP unless it is the entrypoint
      serverPromise.cancel()

      this.#app = await this.#module.build()
      this.#isFastify = isFastify(this.#app)

      if (this.#isFastify) {
        await this.#app.ready()
      } else if (this.#app instanceof Server) {
        this.#server = this.#app
        this.#dispatcher = this.#server.listeners('request')[0]
      }
    } else {
      // User blackbox function, we wait for it to listen on a port
      this.#server = await serverPromise
      this.url = getServerUrl(this.#server)
    }

    return this.url
  }

  async stop () {
    if (this.#isFastify) {
      return this.#app.close()
    }

    if (this.#server) {
      /* c8 ignore next 3 */
      if (!this.#server.listening) {
        return
      }

      return new Promise((resolve, reject) => {
        this.#server.close(error => {
          /* c8 ignore next 3 */
          if (error) {
            return reject(error)
          }

          resolve(error)
        })
      })
    }
  }

  async inject (injectParams, onInject) {
    let res
    if (this.#isFastify) {
      res = await this.#app.inject(injectParams, onInject)
    } else if (this.#dispatcher) {
      res = await inject(this.#dispatcher, injectParams, onInject)
    } else {
      res = await injectViaRequest(this.url, injectParams, onInject)
    }

    /* c8 ignore next 3 */
    if (onInject) {
      return
    }

    // Since inject might be called from the main thread directly via ITC, let's clean it up
    const { statusCode, headers, body, payload, rawPayload } = res

    return { statusCode, headers, body, payload, rawPayload }
  }

  getMeta () {
    return {
      deploy: this.configManager.current.deploy
    }
  }

  async _listen () {
    const serverOptions = this.serverConfig

    if (this.#isFastify) {
      await this.#app.listen({ host: serverOptions?.hostname || '127.0.0.1', port: serverOptions?.port || 0 })
      this.url = getServerUrl(this.#app.server)
    } else {
      // Express / Node
      this.#server = await new Promise((resolve, reject) => {
        return this.#app
          .listen({ host: serverOptions?.hostname || '127.0.0.1', port: serverOptions?.port || 0 }, function () {
            resolve(this)
          })
          .on('error', reject)
      })

      this.url = getServerUrl(this.#server)
    }

    return this.url
  }

  _getApplication () {
    return this.#app
  }
}

async function getEntrypointInformation (root) {
  let entrypoint
  let packageJson
  let hadEntrypointField = false

  try {
    packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf-8'))
  } catch {
    // No package.json, we only load the index.js file
    packageJson = {}
  }

  for (const field of validFields) {
    let current = packageJson
    const sequence = field.split('#')

    while (current && sequence.length && typeof current !== 'string') {
      current = current[sequence.shift()]
    }

    if (typeof current === 'string') {
      entrypoint = current
      hadEntrypointField = true
      break
    }
  }

  if (!entrypoint) {
    for (const basename of validFilesBasenames) {
      for (const ext of ['js', 'mjs', 'cjs']) {
        const file = `${basename}.${ext}`

        if (existsSync(resolve(root, file))) {
          entrypoint = file
          break
        }
      }

      if (entrypoint) {
        break
      }
    }
  }

  return { entrypoint, hadEntrypointField }
}

export async function buildStackable (opts) {
  const root = opts.context.directory

  const { entrypoint, hadEntrypointField } = await getEntrypointInformation(root)

  const configManager = new ConfigManager({ schema, source: opts.config ?? {}, transformConfig })
  await configManager.parseAndValidate()

  return new NodeStackable(opts, root, configManager, entrypoint, hadEntrypointField)
}

export default {
  configType: 'nodejs',
  configManagerConfig: {
    transformConfig
  },
  buildStackable,
  schema,
  version: packageJson.version
}
