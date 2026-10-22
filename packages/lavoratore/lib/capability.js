import {
  BaseCapability,
  buildAdditionalServerOptions,
  buildListenOptions,
  cleanBasePath,
  ensureTrailingSlash,
  errors,
  getServerUrl,
  injectViaRequest
} from '@platformatic/basic'
import { ensureLoggableError } from '@platformatic/foundation'
import inject from 'light-my-request'
import { createServer as createHttpServer } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { toRequest, writeResponse } from './http.js'
import { WorkerRunner } from './runner.js'
import { version } from './schema.js'
import { loadDevVars, loadWranglerConfig } from './wrangler.js'

const entrypointCandidates = ['src/index', 'src/worker', 'index', 'worker'].flatMap(base =>
  ['js', 'mjs', 'ts', 'mts'].map(ext => `${base}.${ext}`)
)

async function findEntrypoint (root) {
  try {
    const { main } = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf-8'))

    if (typeof main === 'string') {
      return resolve(root, main)
    }
  } catch {
    // No package.json, continue with autodetection
  }

  const candidate = entrypointCandidates.find(file => existsSync(resolve(root, file)))
  return candidate ? resolve(root, candidate) : null
}

export class LavoratoreCapability extends BaseCapability {
  #runner
  #server
  #handler
  #basePath
  #crons

  constructor (root, config, context) {
    super('lavoratore', version, root, config, context)
    this.#crons = []
    this.#handler = this.#handle.bind(this)
  }

  async start ({ listen }) {
    // Make this idempotent
    if (this.url) {
      return this.url
    }

    if (this.#runner) {
      if (listen) {
        await this._listen()
      }

      return this.url
    }

    await super._start({ listen })

    const config = this.config
    const command = config.application.commands[this.isProduction ? 'production' : 'development']

    if (command) {
      return this.startWithCommand(command)
    }

    this.#basePath = config.application?.basePath
      ? ensureTrailingSlash(cleanBasePath(config.application.basePath))
      : undefined

    this.registerGlobals({ basePath: this.#basePath })

    const options = config.lavoratore
    const { path, config: wrangler } = await loadWranglerConfig(this.root, options.configFile, options.environment)

    // As in Wrangler, the entrypoint in the configuration file is relative to the file itself
    let entrypoint
    if (options.main) {
      entrypoint = resolve(this.root, options.main)
    } else if (wrangler.main) {
      entrypoint = resolve(dirname(path), wrangler.main)
    } else {
      entrypoint = await findEntrypoint(this.root)
    }

    if (!entrypoint) {
      throw new Error(
        `The application "${this.applicationId}" has no Worker entrypoint. Set "lavoratore.main" in the application configuration file, or "main" in the package.json or Wrangler configuration file.`
      )
    }

    const vars = {
      ...wrangler.vars,
      ...(this.isProduction ? {} : await loadDevVars(this.root, options.environment)),
      ...options.vars
    }

    this.#crons = options.crons ?? wrangler.triggers?.crons ?? []

    const services = {
      ...Object.fromEntries((wrangler.services ?? []).map(({ binding, service }) => [binding, service])),
      ...options.services
    }

    const runner = new WorkerRunner({ entrypoint, wrangler, vars, services, logger: this.logger })
    await runner.start()
    this.#runner = runner

    if (listen) {
      await this._listen()
    }

    await this._collectMetrics()
    return this.url
  }

  async stop () {
    await super.stop()

    if (this.childManager) {
      return this.stopCommand()
    }

    if (this.#server?.listening) {
      await this._closeServer(this.#server)
    }

    await this.#runner?.stop()
  }

  async build () {
    const command = this.config.application?.commands?.build

    if (!command) {
      this.logger.debug('No "application.commands.build" configuration value specified. Skipping build ...')
      return
    }

    return this.buildWithCommand(command, null)
  }

  async inject (injectParams, onInject) {
    const res = this.childManager
      ? await injectViaRequest(this.url, injectParams, onInject)
      : await inject(this.#handler, injectParams, onInject)

    /* c8 ignore next 3 */
    if (onInject) {
      return
    }

    // Since inject might be called from the main thread directly via ITC, let's clean it up
    const { statusCode, headers, body, payload, rawPayload } = res
    return { statusCode, headers, body, payload, rawPayload }
  }

  async getScheduledTasks () {
    return this.#crons.map((cron, index) => ({ id: String(index), cron, tasks: [cron] }))
  }

  async runScheduledTasks (scheduleId, scheduledTime) {
    const cron = this.#crons[scheduleId]

    if (typeof cron !== 'string') {
      throw new errors.ScheduledTaskGroupNotFound(scheduleId)
    }

    await this.#runner.scheduled(cron, scheduledTime)
    return [cron]
  }

  getMeta () {
    return {
      gateway: {
        tcp: typeof this.url !== 'undefined',
        url: this.url,
        prefix: this.basePath ?? this.#basePath,
        wantsAbsoluteUrls: false,
        needsRootTrailingSlash: false
      },
      connectionStrings: this.connectionString ? [this.connectionString] : []
    }
  }

  async getDispatchTarget () {
    return this.childManager ? this.getUrl() : this.#handler
  }

  getDispatchFunc () {
    return this.#handler
  }

  async getWatchConfig () {
    const watchConfig = await super.getWatchConfig()

    // Ignore the local storage of Wrangler
    if (watchConfig.enabled && !watchConfig.ignore) {
      watchConfig.ignore = ['.wrangler', '.wrangler/*', '.wrangler/**/*']
    }

    return watchConfig
  }

  async _listen () {
    /* c8 ignore next 3 */
    if (this.url) {
      return this.url
    }

    const serverOptions = this.serverConfig
    const { backlog, ...httpsOptions } = await buildAdditionalServerOptions(serverOptions)

    this.#server = serverOptions?.https
      ? createHttpsServer(httpsOptions, this.#handler)
      : createHttpServer(this.#handler)

    await new Promise((resolve, reject) => {
      this.#server.once('error', reject)
      this.#server.listen({ ...buildListenOptions(serverOptions), backlog }, () => {
        this.#server.removeListener('error', reject)
        resolve()
      })
    })

    this.url = getServerUrl(this.#server)
    return this.url
  }

  async #handle (req, res) {
    if (this.closing && req.httpVersionMajor !== 2) {
      res.setHeader('connection', 'close')
    }

    try {
      const response = await this.#runner.fetch(toRequest(req, res))
      await writeResponse(res, response)
    } catch (err) {
      this.logger.error({ err: ensureLoggableError(err) }, 'The Worker failed to handle the request.')

      if (res.headersSent) {
        res.destroy(err)
        return
      }

      res.writeHead(500, { 'content-type': 'text/plain' })
      res.end('Internal Server Error')
    }
  }
}
