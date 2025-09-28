import {
  BaseCapability,
  cleanBasePath,
  createServerListener,
  ensureTrailingSlash,
  getServerUrl,
  importFile,
  injectViaRequest
} from '@platformatic/basic'
import { features } from '@platformatic/foundation'
import inject from 'light-my-request'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { Server } from 'node:http'
import { resolve as resolvePath } from 'node:path'
import { version } from './schema.js'
import { getTsconfig, ignoreDirs, isApplicationBuildable } from './utils.js'

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

function isKoa (app) {
  return typeof app.callback === 'function'
}

async function getEntrypointInformation (root) {
  let entrypoint
  let packageJson
  let hadEntrypointField = false

  try {
    packageJson = JSON.parse(await readFile(resolvePath(root, 'package.json'), 'utf-8'))
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

        if (existsSync(resolvePath(root, file))) {
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

export class NodeCapability extends BaseCapability {
  #module
  #app
  #server
  #basePath
  #dispatcher
  #isFastify
  #isKoa
  #appClose
  #useHttpForDispatch

  constructor (root, config, context) {
    super('nodejs', version, root, config, context)
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

    const config = this.config

    if (!this.isProduction && (await isApplicationBuildable(this.root, config))) {
      this.logger.info(`Building application "${this.applicationId}" before starting in development mode ...`)
      try {
        await this.build()
        this.childManager = null
      } catch (e) {
        this.logger.error(`Error while building application "${this.applicationId}": ${e.message}`)
      }
    }

    const command = config.application.commands[this.isProduction ? 'production' : 'development']

    if (command) {
      return this.startWithCommand(command)
    }

    // Resolve the entrypoint
    // The priority is platformatic.application.json, then package.json and finally autodetect.
    // Only when autodetecting we eventually search in the dist folder when in production mode
    const finalEntrypoint = await this._findEntrypoint()

    // Require the application
    this.#basePath = config.application?.basePath
      ? ensureTrailingSlash(cleanBasePath(config.application?.basePath))
      : undefined

    this.registerGlobals({
      basePath: this.#basePath
    })

    // The server promise must be created before requiring the entrypoint even if it's not going to be used
    // at all. Otherwise there is chance we miss the listen event.
    const serverOptions = this.serverConfig
    const serverPromise = createServerListener(
      (this.isEntrypoint ? serverOptions?.port : undefined) ?? true,
      (this.isEntrypoint ? serverOptions?.hostname : undefined) ?? true
    )
    this.#module = await importFile(finalEntrypoint)
    this.#module = this.#module.default || this.#module

    // Deal with application
    const factory = ['build', 'create'].find(f => typeof this.#module[f] === 'function')
    this.#appClose = this.#module['close']

    if (this.#hasServer()) {
      if (factory) {
        // We have build function, this Capability will not use HTTP unless it is the entrypoint
        serverPromise.cancel()

        this.#app = await this.#module[factory]()
        this.#isFastify = isFastify(this.#app)
        this.#isKoa = isKoa(this.#app)

        if (this.#isFastify) {
          await this.#app.ready()
        } else if (this.#isKoa) {
          this.#dispatcher = this.#app.callback()
        } else if (this.#app instanceof Server) {
          this.#server = this.#app
          this.#dispatcher = this.#server.listeners('request')[0]
        }

        if (listen) {
          await this._listen()
        }
      } else {
        // User blackbox function, we wait for it to listen on a port
        this.#server = await serverPromise
        this.#dispatcher = this.#server.listeners('request')[0]

        this.url = getServerUrl(this.#server)
      }
    }

    await this._collectMetrics()
    return this.url
  }

  #hasServer () {
    return this.config.node?.hasServer !== false && this.#module.hasServer !== false
  }

  async stop () {
    await super.stop()

    if (this.childManager) {
      return this.stopCommand()
    }

    // for no-server apps, we support custom close method
    if (this.#appClose && !this.#hasServer()) {
      return this.#appClose()
    }

    // This is needed if the capability was subclassed
    if (!this.#server && !this.#app) {
      return
    }

    if (this.#isFastify && this.#app) {
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
    const config = this.config
    const disableChildManager = config.node?.disablePlatformaticInBuild
    const command = config.application?.commands?.build

    if (command) {
      return this.buildWithCommand(command, null, { disableChildManager })
    }

    // If no command was specified, we try to see if there is a build script defined in package.json.
    const hasBuildScript = await this.#hasBuildScript()

    if (!hasBuildScript) {
      this.logger.debug(
        'No "application.commands.build" configuration value specified and no build script found in package.json. Skipping build ...'
      )
      return
    }

    return this.buildWithCommand('npm run build', null, { disableChildManager })
  }

  async inject (injectParams, onInject) {
    let res

    if (this.#useHttpForDispatch) {
      this.logger.trace({ injectParams, url: this.url }, 'injecting via request')
      res = await injectViaRequest(this.url, injectParams, onInject)
    } else {
      if (this.#isFastify) {
        this.logger.trace({ injectParams }, 'injecting via fastify')
        res = await this.#app.inject(injectParams, onInject)
      } else {
        this.logger.trace({ injectParams }, 'injecting via light-my-request')
        res = await inject(this.#dispatcher ?? this.#app, injectParams, onInject)
      }
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
    const config = this.config
    return config.node.absoluteUrl
  }

  getMeta () {
    return {
      gateway: {
        tcp: typeof this.url !== 'undefined',
        url: this.url,
        prefix: this.basePath ?? this.#basePath,
        wantsAbsoluteUrls: this._getWantsAbsoluteUrls(),
        needsRootTrailingSlash: true
      },
      connectionStrings: this.connectionString ? [this.connectionString] : []
    }
  }

  async getDispatchTarget () {
    this.#useHttpForDispatch = this.childManager || (this.url && this.config.node?.dispatchViaHttp === true)

    if (this.#useHttpForDispatch) {
      return this.getUrl()
    }

    return this.getDispatchFunc()
  }

  async _listen () {
    // Make this idempotent
    /* c8 ignore next 3 */
    if (this.url) {
      return this.url
    }

    const serverOptions = this.serverConfig
    const listenOptions = { host: serverOptions?.hostname || '127.0.0.1', port: serverOptions?.port || 0 }

    if (this.isProduction && features.node.reusePort) {
      listenOptions.reusePort = true
    }

    if (this.#isFastify) {
      await this.#app.listen(listenOptions)
      this.url = getServerUrl(this.#app.server)
    } else {
      // Express / Node / Koa
      this.#server = await new Promise((resolve, reject) => {
        return this.#app
          .listen(listenOptions, function () {
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
    const config = this.config

    if (config.node.main) {
      return resolvePath(this.root, config.node.main)
    }

    const { entrypoint, hadEntrypointField } = await getEntrypointInformation(this.root)

    if (typeof this.workerId === 'undefined' || this.workerId === 0) {
      if (!entrypoint) {
        this.logger.error(
          `The application "${this.applicationId}" had no valid entrypoint defined in the package.json file and no valid entrypoint file was found.`
        )

        process.exit(1)
      }

      if (!hadEntrypointField) {
        this.logger.warn(
          `The application "${this.applicationId}" had no valid entrypoint defined in the package.json file. Falling back to the file "${entrypoint}".`
        )
      }
    }

    return resolvePath(this.root, entrypoint)
  }

  async #hasBuildScript () {
    // If no command was specified, we try to see if there is a build script defined in package.json.
    let hasBuildScript
    try {
      const packageJson = JSON.parse(await readFile(resolvePath(this.root, 'package.json'), 'utf-8'))
      hasBuildScript = typeof packageJson.scripts.build === 'string' && packageJson.scripts.build
    } catch (e) {
      // No-op
    }

    return hasBuildScript
  }

  async getWatchConfig () {
    const config = this.config

    const enabled = config.watch?.enabled !== false

    if (!enabled) {
      return { enabled, path: this.root }
    }

    // ignore the outDir from tsconfig or application config if any
    let ignore = config.watch?.ignore
    if (!ignore) {
      const tsConfig = await getTsconfig(this.root, config)
      if (tsConfig) {
        ignore = ignoreDirs(tsConfig?.compilerOptions?.outDir, tsConfig?.watchOptions?.excludeDirectories)
      }
    }

    return {
      enabled,
      path: this.root,
      allow: config.watch?.allow,
      ignore
    }
  }
}
