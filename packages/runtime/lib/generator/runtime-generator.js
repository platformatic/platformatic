'use strict'
const { BaseGenerator } = require('@platformatic/generators')
const { NoEntryPointError, NoServiceNamedError } = require('./errors')
const generateName = require('boring-name-generator')
const { join } = require('node:path')
const { envObjectToString } = require('@platformatic/generators/lib/utils')
class RuntimeGenerator extends BaseGenerator {
  constructor (opts) {
    super(opts)
    this.services = []
    this.entryPoint = null
  }

  async addService (service, name) {
    // ensure service config is correct
    const originalConfig = service.config
    const serviceName = name || generateName().dashed
    const newConfig = {
      ...originalConfig,
      isRuntimeContext: true,
      serviceName
    }
    // reset all files previously generated by the service
    service.reset()
    service.setConfig(newConfig)
    this.services.push({
      name: serviceName,
      service
    })

    if (service.type === 'composer') {
      service.setRuntime(this)
    }
  }

  setEntryPoint (entryPoint) {
    const service = this.services.find((svc) => svc.name === entryPoint)
    if (!service) {
      throw new NoServiceNamedError(entryPoint)
    }
    this.entryPoint = service
  }

  async generatePackageJson () {
    return {
      scripts: {
        start: 'platformatic start',
        test: 'node --test test/*/*.test.js'
      },
      devDependencies: {
        fastify: `^${this.fastifyVersion}`
      },
      dependencies: {
        platformatic: `^${this.platformaticVersion}`
      },
      engines: {
        node: '^18.8.0 || >=20.6.0'
      }
    }
  }

  async _beforePrepare () {
    this.setServicesDirectory()

    this.config.env = {
      PLT_SERVER_HOSTNAME: '0.0.0.0',
      PORT: this.config.port || 3042,
      PLT_SERVER_LOGGER_LEVEL: 'info',
      ...this.config.env
    }
  }

  async _getConfigFileContents () {
    const config = {
      $schema: `https://platformatic.dev/schemas/v${this.platformaticVersion}/runtime`,
      entrypoint: this.entryPoint.name,
      allowCycles: false,
      hotReload: true,
      autoload: {
        path: 'services',
        exclude: ['docs']
      },
      server: {
        hostname: '{PLT_SERVER_HOSTNAME}',
        port: '{PORT}',
        logger: {
          level: '{PLT_SERVER_LOGGER_LEVEL}'
        }
      }
    }

    return config
  }

  async _afterPrepare () {
    if (!this.entryPoint) {
      throw new NoEntryPointError()
    }
    const servicesEnv = await this.prepareServiceFiles()
    this.config.env = {
      ...this.config.env,
      ...this.getRuntimeEnv(),
      ...servicesEnv
    }

    this.addFile({
      path: '',
      file: '.env',
      contents: envObjectToString(this.config.env)
    })

    return {
      targetDirectory: this.targetDirectory,
      env: servicesEnv
    }
  }

  async writeFiles () {
    await super.writeFiles()
    for (const { service } of this.services) {
      await service.writeFiles()
    }
  }

  setServicesDirectory () {
    this.services.forEach(({ service }) => {
      if (!service.config) {
        // set default config
        service.setConfig()
      }
      service.setTargetDirectory(join(this.targetDirectory, 'services', service.config.serviceName))
    })
  }

  setServicesConfig (configToOverride) {
    this.services.forEach((service) => {
      const originalConfig = service.config
      service.setConfig({
        ...originalConfig,
        ...configToOverride
      })
    })
  }

  async prepareServiceFiles () {
    let servicesEnv = {}
    for (const svc of this.services) {
      const svcEnv = await svc.service.prepare()
      servicesEnv = {
        ...servicesEnv,
        ...svcEnv.env
      }
    }
    return servicesEnv
  }

  getRuntimeEnv () {
    return {
      PORT: this.config.port
    }
  }
}

module.exports = RuntimeGenerator
module.exports.RuntimeGenerator = RuntimeGenerator
