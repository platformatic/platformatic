import {
  BaseStackable,
  cleanBasePath,
  createServerListener,
  ensureTrailingSlash,
  getServerUrl,
  importFile,
  injectViaRequest,
  schemaOptions,
  transformConfig
} from '@platformatic/basic'
import { ConfigManager } from '@platformatic/config'
import inject from 'light-my-request'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { Server } from 'node:http'
import { resolve as pathResolve, resolve } from 'node:path'
import { pathToFileURL } from 'url'
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
  #module
  #app
  #server
  #dispatcher
  #isFastify

  constructor (options, root, configManager) {
    super('nodejs', packageJson.version, options, root, configManager)
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

    const config = this.configManager.current
    const command = config.application.commands[this.isProduction ? 'production' : 'development']

    if (command) {
      return this.startWithCommand(command)
    }

    // Resolve the entrypoint
    // The priority is platformatic.application.json, then package.json and finally autodetect.
    // Only when autodetecting we eventually search in the dist folder when in production mode
    const finalEntrypoint = await this._findEntrypoint()

    // Require the application
    const basePath = config.application?.basePath
      ? ensureTrailingSlash(cleanBasePath(config.application?.basePath))
      : undefined

    this.registerGlobals({
      // Always use URL to avoid serialization problem in Windows
      id: this.id,
      root: pathToFileURL(this.root).toString(),
      basePath,
      logLevel: this.logger.level
    })

    // The server promise must be created before requiring the entrypoint even if it's not going to be used
    // at all. Otherwise there is chance we miss the listen event.
    const serverOptions = this.serverConfig
    const serverPromise = createServerListener((this.isEntrypoint ? serverOptions?.port : undefined) ?? true)
    this.#module = await importFile(finalEntrypoint)
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
    if (this.subprocess) {
      return this.stopCommand()
    }

    if (this.#isFastify) {
      return this.#app.close()
    }

    /* c8 ignore next 3 */
    if (!this.#server?.listening) {
      return
    }

    return new Promise((resolve, reject) => {
      this.#server.close(error => {
        /* c8 ignore next 3 */
        if (error) {
          return reject(error)
        }

        resolve()
      })
    })
  }

  async build () {
    const command = this.configManager.current.application.commands.build

    if (command) {
      return this.buildWithCommand(command, null)
    }

    // If no command was specified, we try to see if there is a build script defined in package.json.
    const hasBuildScript = await this.#hasBuildScript()

    if (!hasBuildScript) {
      this.logger.warn(
        'No "application.commands.build" configuration value specified and no build script found in package.json. Skipping build ...'
      )
      return
    }

    return this.buildWithCommand('npm run build', null)
  }

  async inject (injectParams, onInject) {
    let res

    if (this.url) {
      this.logger.trace({ injectParams, url: this.url }, 'injecting via request')
      res = await injectViaRequest(this.url, injectParams, onInject)
    } else if (this.#isFastify) {
      this.logger.trace({ injectParams }, 'injecting via fastify')
      res = await this.#app.inject(injectParams, onInject)
    } else {
      this.logger.trace({ injectParams }, 'injecting via light-my-request')
      res = await inject(this.#dispatcher ?? this.#app, injectParams, onInject)
    }

    /* c8 ignore next 3 */
    if (onInject) {
      return
    }

    // Since inject might be called from the main thread directly via ITC, let's clean it up
    const { statusCode, headers, body, payload, rawPayload } = res

    return { statusCode, headers, body, payload, rawPayload }
  }

  _getWantsAbsoluteUrls () {
    const config = this.configManager.current
    return config.node.absoluteUrl
  }

  getMeta () {
    const config = this.configManager.current
    let composer = {
      prefix: this.servicePrefix,
      wantsAbsoluteUrls: this._getWantsAbsoluteUrls(),
      needsRootRedirect: true
    }

    if (this.url) {
      composer = {
        tcp: true,
        url: this.url,
        prefix: config.application?.basePath
          ? ensureTrailingSlash(cleanBasePath(config.application?.basePath))
          : this.servicePrefix,
        wantsAbsoluteUrls: this._getWantsAbsoluteUrls(),
        needsRootRedirect: true
      }
    }

    return { composer }
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

  async _findEntrypoint () {
    const config = this.configManager.current
    const outputRoot = resolve(this.root, config.application.outputDirectory)

    if (config.node.main) {
      return pathResolve(this.root, config.node.main)
    }

    const { entrypoint, hadEntrypointField } = await getEntrypointInformation(this.root)

    if (!entrypoint) {
      this.logger.error(
        `The service ${this.id} had no valid entrypoint defined in the package.json file and no valid entrypoint file was found.`
      )

      process.exit(1)
    }

    if (!hadEntrypointField) {
      this.logger.warn(
        `The service ${this.id} had no valid entrypoint defined in the package.json file. Falling back to the file "${entrypoint}".`
      )
    }

    let root = this.root

    if (this.isProduction) {
      const hasCommand = this.configManager.current.application.commands.build
      const hasBuildScript = await this.#hasBuildScript()

      if (hasCommand || hasBuildScript) {
        this.verifyOutputDirectory(outputRoot)
        root = outputRoot
      }
    }

    return pathResolve(root, entrypoint)
  }

  async #hasBuildScript () {
    // If no command was specified, we try to see if there is a build script defined in package.json.
    let hasBuildScript
    try {
      const packageJson = JSON.parse(await readFile(resolve(this.root, 'package.json'), 'utf-8'))
      hasBuildScript = typeof packageJson.scripts.build === 'string' && packageJson.scripts.build
    } catch (e) {
      // No-op
    }

    return hasBuildScript
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

  const configManager = new ConfigManager({
    schema,
    source: opts.config ?? {},
    schemaOptions,
    transformConfig,
    dirname: root
  })
  await configManager.parseAndValidate()

  return new NodeStackable(opts, root, configManager)
}

export { schema, schemaComponents } from './lib/schema.js'

export default {
  configType: 'nodejs',
  configManagerConfig: {
    schemaOptions,
    transformConfig
  },
  buildStackable,
  schema,
  version: packageJson.version
}
