import { BaseGenerator } from '@platformatic/generators'

export class Generator extends BaseGenerator {
  constructor (opts = {}) {
    super({
      ...opts,
      module: '@platformatic/service'
    })
  }

  getDefaultConfig () {
    const config = super.getDefaultConfig()
    config.plugin = true
    config.tests = true
    return config
  }

  async _beforePrepare () {
    // if we are NOT updating, create env and files, otherwise leave as it is
    if (!this.config.isUpdating) {
      if (!this.config.isRuntimeContext) {
        this.addEnvVars(
          {
            PLT_SERVER_HOSTNAME: this.config.hostname,
            PLT_SERVER_LOGGER_LEVEL: 'info',
            PORT: 3042
          },
          { overwrite: false }
        )
      }

      this.config.dependencies = {
        '@platformatic/service': `^${this.platformaticVersion}`
      }
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
    // if we are NOT updating, create env and files, otherwise leave as it is
    if (!this.config.isUpdating) {
      const PLT_ENVIRONMENT_TEMPLATE = `
import { type FastifyInstance } from 'fastify'
import { PlatformaticApplication, PlatformaticServiceConfig } from '@platformatic/service'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApplication<PlatformaticServiceConfig>
  }
}
`

      const README = `
# Platformatic Service API

This is a generated [Platformatic Service](https://docs.platformatic.dev/docs/service/overview) application.

## Requirements

Platformatic supports macOS, Linux and Windows ([WSL](https://docs.microsoft.com/windows/wsl/) recommended).
You'll need to have [Node.js](https://nodejs.org/) >= v18.8.0 or >= v20.6.0

## Setup

Install dependencies:

\`\`\`bash
npm install
\`\`\`

## Usage

Run the API with:

\`\`\`bash
npm start
\`\`\`

### Explore
- ⚡ The Platformatic DB server is running at http://localhost:3042/
- 📔 View the REST API's Swagger documentation at http://localhost:3042/documentation/
- 🔍 Try out the GraphiQL web UI at http://localhost:3042/graphiql
`

      this.addFile({ path: '', file: 'plt-env.d.ts', contents: PLT_ENVIRONMENT_TEMPLATE })
      this.addFile({ path: '', file: 'README.md', contents: README })
    }
  }

  async _getConfigFileContents () {
    const { isRuntimeContext } = this.config
    const version = this.platformaticVersion
    const config = {
      $schema: `https://schemas.platformatic.dev/@platformatic/service/${version}.json`,
      service: {
        openapi: true
      },
      watch: true
    }
    if (this.config.plugin) {
      config.plugins = {
        paths: [{ path: './plugins', encapsulate: false }, './routes']
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
