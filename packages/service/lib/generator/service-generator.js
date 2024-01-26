'use strict'

const { BaseGenerator } = require('@platformatic/generators')
const { readFile } = require('node:fs/promises')
const { join } = require('node:path')

class ServiceGenerator extends BaseGenerator {
  constructor (opts = {}) {
    super({
      ...opts,
      module: '@platformatic/service'
    })
  }

  async _beforePrepare () {
    this.config.env = {
      PLT_SERVER_HOSTNAME: this.config.hostname,
      PLT_SERVER_LOGGER_LEVEL: 'info',
      PORT: 3042,
      ...this.config.env

    }
    this.config.dependencies = {
      '@platformatic/service': `^${this.platformaticVersion}`
    }
  }

  getConfigFieldsDefinitions () {
    if (this.config.isRuntimeContext) {
      return []
    }
    return [
      {
        var: 'PLT_SERVER_HOSTNAME',
        label: 'What is the hostname?',
        default: '0.0.0.0',
        type: 'string',
        configValue: 'hostname'
      },
      {
        var: 'PLT_SERVER_LOGGER_LEVEL',
        label: 'What is the logger level?',
        default: 'info',
        type: 'string',
        configValue: ''
      },
      {
        label: 'Which port do you want to use?',
        var: 'PORT',
        default: 3042,
        type: 'number',
        configValue: 'port'
      }
    ]
  }

  async _afterPrepare () {
    const GLOBAL_TYPES_TEMPLATE = `
import { FastifyInstance } from 'fastify'
import { PlatformaticApp, PlatformaticServiceConfig } from '@platformatic/service'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApp<PlatformaticServiceConfig>
  }
}
`
    this.addFile({ path: '', file: 'global.d.ts', contents: GLOBAL_TYPES_TEMPLATE })
    if (this.config.isRuntimeContext) {
      // remove env variables that are not for the plugins
      delete this.config.env.PLT_SERVER_HOSTNAME
      delete this.config.env.PORT
      delete this.config.env.PLT_SERVER_LOGGER_LEVEL
    }

    this.addFile({ path: '', file: 'README.md', contents: await readFile(join(__dirname, 'README.md')) })
  }

  async _getConfigFileContents () {
    const { typescript, isRuntimeContext } = this.config
    const version = this.platformaticVersion
    const config = {
      $schema: `https://platformatic.dev/schemas/v${version}/service`,
      service: {
        openapi: true
      },
      watch: true
    }
    if (this.config.plugin) {
      config.plugins = {
        paths: [
          { path: './plugins', encapsulate: false },
          './routes'
        ]
      }

      if (typescript === true) {
        config.plugins.typescript = true
      }
    }

    if (!isRuntimeContext) {
      config.server = {
        hostname: '{PLT_SERVER_HOSTNAME}',
        port: '{PORT}',
        logger: {
          level: '{PLT_SERVER_LOGGER_LEVEL}'
        }
      }
    }

    return config
  }
}

module.exports = ServiceGenerator
module.exports.ServiceGenerator = ServiceGenerator
module.exports.Generator = ServiceGenerator
