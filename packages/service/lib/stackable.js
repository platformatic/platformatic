'use strict'

const { printSchema } = require('graphql')

class PlatformaticServiceStackable {
  constructor (options) {
    this._init = options.init
    this.stackable = options.stackable
    this.serviceId = options.id

    this.configManager = options.configManager
    this.config = this.configManager.current
  }

  async init () {
    this.app = await this._init()
    return this.app
  }

  async start (options = {}) {
    // this.app = await this.init()

    if (options.listen === false) {
    //   console.log('Starting service---1---------------------------', options)
      await this.app.ready()
      //   console.log('Starting service---2---------------------------', options)

      return
    }
    // console.log(this.configManager.current.server.logger)
    await this.app.start()
  }

  async stop () {
    await this.app.close()
  }

  getUrl () {
    return this.app.url
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
    await this.app.ready()
    return this.app.swagger ? this.app.swagger() : null
  }

  async getGraphqlSchema () {
    await this.app.ready()
    return this.app.graphql ? printSchema(this.app.graphql.schema) : null
  }

  async getMetrics ({ format }) {
    const promRegister = this.app.metrics?.client?.register
    if (!promRegister) return null

    return format === 'json'
      ? promRegister.getMetricsAsJSON()
      : promRegister.metrics()
  }

  async inject (injectParams) {
    const { statusCode, headers, body } = await this.app.inject(injectParams)
    return { statusCode, headers, body }
  }

  async log (message, options = {}) {
    const logLevel = options.level ?? 'info'
    this.app.log[logLevel](message)
  }
}

module.exports = { PlatformaticServiceStackable }
