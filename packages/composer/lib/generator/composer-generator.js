'use strict'

const { BaseGenerator, addPrefixToEnv } = require('@platformatic/generators')

class ComposerGenerator extends BaseGenerator {
  constructor (opts) {
    super(opts)
    this.type = 'composer'
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
        .filter(serviceMeta => serviceMeta.service.type !== 'composer')
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
      this.config.env = {
        EXAMPLE_ORIGIN: 'http://127.0.0.1:3043'
      }
      this.config.env = addPrefixToEnv(this.config.env, this.config.envPrefix)
    }
  }

  setRuntime (runtime) {
    this.runtime = runtime
  }
}

module.exports = ComposerGenerator
module.exports.ComposerGenerator = ComposerGenerator
module.exports.Generator = ComposerGenerator
