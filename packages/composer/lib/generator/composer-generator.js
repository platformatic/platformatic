'use strict'

const { BaseGenerator, addPrefixToEnv } = require('@platformatic/generators')
const { getPackageConfigurationObject } = require('@platformatic/generators/lib/utils')
const { join } = require('node:path')
const { readFile } = require('node:fs/promises')

class ComposerGenerator extends BaseGenerator {
  constructor (opts) {
    super({
      ...opts,
      module: '@platformatic/composer'
    })
    this.runtime = null
  }

  async _getConfigFileContents () {
    const { envPrefix } = this.config
    const exampleOriginValue = envPrefix ? `PLT_${envPrefix}_EXAMPLE_ORIGIN` : 'PLT_EXAMPLE_ORIGIN'

    const template = {
      $schema: `https://platformatic.dev/schemas/v${this.platformaticVersion}/composer`,
      composer: {
        services: [
          {
            id: 'example',
            origin: `{${exampleOriginValue}}`,
            openapi: {
              url: '/documentation/json'
            }
          }
        ],
        refreshTimeout: 1000
      },
      watch: true
    }
    if (this.runtime !== null) {
      template.composer.services = this.runtime.services
        .filter(serviceMeta => serviceMeta.service.module !== '@platformatic/composer')
        .map((serviceMeta) => {
          return {
            id: serviceMeta.name,
            openapi: {
              url: '/documentation/json',
              prefix: `/${serviceMeta.name}`
            }
          }
        })
    }

    if (this.config.plugin) {
      template.plugins = {
        paths: [
          {
            path: './plugins',
            encapsulate: false
          },
          './routes'
        ]
      }
    }
    if (this.config.typescript === true) {
      template.plugins.typescript = true
    }
    if (!this.config.isRuntimeContext) {
      template.server = {
        hostname: '{PLT_SERVER_HOSTNAME}',
        port: '{PORT}',
        logger: {
          level: '{PLT_SERVER_LOGGER_LEVEL}'
        }
      }
    }

    if (this.packages.length > 0) {
      if (!template.plugins) {
        template.plugins = {}
      }
      template.plugins.packages = this.packages.map((packageDefinition) => {
        const packageConfigOutput = getPackageConfigurationObject(packageDefinition.options, this.config.serviceName)
        if (Object.keys(packageConfigOutput.env).length > 0) {
          const envForPackages = {}
          Object.entries(packageConfigOutput.env).forEach((kv) => {
            envForPackages[kv[0]] = kv[1]
          })

          if (this.config.isRuntimeContext) {
            this.config.env = {
              ...this.config.env,
              ...addPrefixToEnv(envForPackages, this.config.envPrefix)
            }
          }
        }
        return {
          name: packageDefinition.name,
          options: packageConfigOutput.config
        }
      })
    }
    return template
  }

  async _beforePrepare () {
    this.config.env = {
      PLT_SERVER_HOSTNAME: this.config.hostname,
      PLT_SERVER_LOGGER_LEVEL: 'info',
      PORT: 3042,
      PLT_EXAMPLE_ORIGIN: 'http://127.0.0.1:3043',
      ...this.config.env

    }
    this.config.dependencies = {
      '@platformatic/composer': `^${this.platformaticVersion}`
    }
  }

  async _afterPrepare () {
    if (this.config.isRuntimeContext) {
      // remove env variables since they are all for the config.server property
      delete this.config.env.PLT_SERVER_HOSTNAME
      delete this.config.env.PLT_SERVER_LOGGER_LEVEL
      delete this.config.env.PORT
      this.config.env = addPrefixToEnv(this.config.env, this.config.envPrefix)
    }

    this.addFile({ path: '', file: 'README.md', contents: await readFile(join(__dirname, 'README.md')) })
  }

  setRuntime (runtime) {
    this.runtime = runtime
  }
}

module.exports = ComposerGenerator
module.exports.ComposerGenerator = ComposerGenerator
module.exports.Generator = ComposerGenerator
