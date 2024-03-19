'use strict'

const { BaseGenerator } = require('@platformatic/generators')
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
    const template = {
      $schema: `https://platformatic.dev/schemas/v${this.platformaticVersion}/composer`,
      composer: {
        services: [
          {
            id: 'example',
            origin: `{${this.getEnvVarName('PLT_EXAMPLE_ORIGIN')}}`,
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
        ],
        typescript: `{${this.getEnvVarName('PLT_TYPESCRIPT')}}`
      }
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
    if (!this.config.isUpdating) {
      if (!this.config.isRuntimeContext) {
        this.addEnvVars({
          PLT_SERVER_HOSTNAME: this.config.hostname,
          PLT_SERVER_LOGGER_LEVEL: 'info',
          PORT: 3042
        }, { overwrite: false })
      }

      this.addEnvVars({
        PLT_TYPESCRIPT: this.config.typescript,
        PLT_EXAMPLE_ORIGIN: 'http://127.0.0.1:3043'
      }, { overwrite: false })

      this.config.dependencies = {
        '@platformatic/composer': `^${this.platformaticVersion}`
      }
    }
  }

  async _afterPrepare () {
    if (!this.config.isUpdating) {
      const GLOBAL_TYPES_TEMPLATE = `
import { FastifyInstance } from 'fastify'
import { PlatformaticApp, PlatformaticComposerConfig } from '@platformatic/composer'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApp<PlatformaticComposerConfig>
  }
}
`
      this.addFile({ path: '', file: 'global.d.ts', contents: GLOBAL_TYPES_TEMPLATE })
      this.addFile({ path: '', file: 'README.md', contents: await readFile(join(__dirname, 'README.md')) })
    }
  }

  setRuntime (runtime) {
    this.runtime = runtime
  }
}

module.exports = ComposerGenerator
module.exports.ComposerGenerator = ComposerGenerator
module.exports.Generator = ComposerGenerator
