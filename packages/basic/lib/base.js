import pino from 'pino'

export class BaseStackable {
  constructor (type, version, options, root, configManager) {
    this.type = type
    this.version = version
    this.id = options.context.serviceId
    this.root = root
    this.configManager = configManager
    this.serverConfig = options.context.serverConfig
    this.openapiSchema = null
    this.getGraphqlSchema = null

    // Setup the logger
    const pinoOptions = {
      level: (this.configManager.current.server ?? this.serverConfig)?.logger?.level ?? 'trace'
    }

    if (this.id) {
      pinoOptions.name = this.id
    }
    this.logger = pino(pinoOptions)

    // Setup globals
    this.registerGlobals({
      setOpenapiSchema: this.setOpenapiSchema.bind(this),
      setGraphqlSchema: this.setGraphqlSchema.bind(this)
    })
  }

  getUrl () {
    return this.url
  }

  async getConfig () {
    return this.configManager.current
  }

  async getWatchConfig () {
    const config = this.configManager.current

    const enabled = config.watch?.enabled !== false

    return {
      enabled,
      path: this.root,
      allow: config.watch?.allow,
      ignore: config.watch?.ignore
    }
  }

  async getInfo () {
    return { type: this.type, version: this.version }
  }

  getDispatchFunc () {
    return this
  }

  async collectMetrics () {
    return {
      defaultMetrics: true,
      httpMetrics: false
    }
  }

  async getOpenapiSchema () {
    return this.openapiSchema
  }

  async getGraphqlSchema () {
    return this.graphqlSchema
  }

  setOpenapiSchema (schema) {
    this.openapiSchema = schema
  }

  setGraphqlSchema (schema) {
    this.graphqlSchema = schema
  }

  async log ({ message, level }) {
    const logLevel = level ?? 'info'
    this.logger[logLevel](message)
  }

  registerGlobals (globals) {
    globalThis.platformatic = Object.assign(globalThis.platformatic ?? {}, globals)
  }
}
