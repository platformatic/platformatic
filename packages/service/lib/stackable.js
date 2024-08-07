'use strict'

const { printSchema } = require('graphql')

class ServiceStackable {
  constructor (options) {
    this.app = null
    this._init = options.init
    this.stackable = options.stackable
    this.serviceId = options.id

    this.configManager = options.configManager
    this.config = this.configManager.current
  }

  async init () {
    if (this.app === null) {
      this.app = await this._init()
    }
    return this.app
  }

  async start (options = {}) {
    await this.init()

    if (options.listen === false) {
      await this.app.ready()
      return
    }
    await this.app.start()
  }

  async stop () {
    if (this.app === null) return
    await this.app.close()
  }

  getUrl () {
    return this.app !== null ? this.app.url : null
  }

  async getInfo () {
    const type = this.stackable.configType
    const version = this.stackable.configManagerConfig.version ?? null
    return { type, version }
  }

  async getConfig () {
    return this.configManager.current
  }

  async getOpenapiSchema () {
    await this.init()
    await this.app.ready()
    return this.app.swagger ? this.app.swagger() : null
  }

  async getGraphqlSchema () {
    await this.init()
    await this.app.ready()
    return this.app.graphql ? printSchema(this.app.graphql.schema) : null
  }

  async getMetrics ({ format }) {
    await this.init()

    const promRegister = this.app.metrics?.client?.register
    if (!promRegister) return null

    return format === 'json'
      ? promRegister.getMetricsAsJSON()
      : promRegister.metrics()
  }

  async inject (injectParams) {
    await this.init()

    const { statusCode, headers, body } = await this.app.inject(injectParams)
    return { statusCode, headers, body }
  }

  async log (message, options = {}) {
    await this.init()

    const logLevel = options.level ?? 'info'
    this.app.log[logLevel](message)
  }
}

module.exports = { ServiceStackable }
