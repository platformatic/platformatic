import inject from 'light-my-request'
import { Server } from 'node:http'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BaseStackable } from './base.js'
import { getServerUrl, injectViaRequest, isFastify } from './utils.js'
import { createServerListener } from './worker/server-listener.js'

export class ServerStackable extends BaseStackable {
  #entrypoint
  #hadEntrypointField
  #module
  #app
  #server
  #dispatcher
  #isFastify

  constructor (options, root, configManager, entrypoint, hadEntrypointField) {
    super(options, root, configManager)
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
      await this.#listen()
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
    this.#module = await import(pathToFileURL(join(this.root, this.#entrypoint)))
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
      if (!this.#server.listening) {
        return
      }

      return new Promise((resolve, reject) => {
        this.#server.close(error => {
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

    if (onInject) {
      return
    }

    // Since inject might be called from the main thread directly via ITC, let's clean it up
    const { statusCode, headers, body, payload, rawPayload } = res

    return { statusCode, headers, body, payload, rawPayload }
  }

  async #listen () {
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
}
