import { BaseGenerator } from '@platformatic/generators'

export class Generator extends BaseGenerator {
  constructor (opts) {
    super({
      ...opts,
      module: '@platformatic/composer'
    })
    this.runtime = null
  }

  getDefaultConfig () {
    const defaultBaseConfig = super.getDefaultConfig()
    return {
      ...defaultBaseConfig,
      plugin: false,
      routes: false,
      tests: false
    }
  }

  async _getConfigFileContents () {
    const template = {
      $schema: `https://schemas.platformatic.dev/@platformatic/composer/${this.platformaticVersion}.json`,
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
        .map(serviceMeta => {
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
        this.addEnvVars(
          {
            PLT_SERVER_HOSTNAME: this.config.hostname,
            PLT_SERVER_LOGGER_LEVEL: 'info',
            PORT: 3042
          },
          { overwrite: false, default: true }
        )
      }

      this.addEnvVars(
        {
          PLT_EXAMPLE_ORIGIN: 'http://127.0.0.1:3043'
        },
        { overwrite: false, default: true }
      )

      this.config.dependencies = {
        '@platformatic/composer': `^${this.platformaticVersion}`
      }
    }
  }

  async _afterPrepare () {
    if (!this.config.isUpdating) {
      const PLT_ENVIRONMENT_TEMPLATE = `
import { type FastifyInstance } from 'fastify'
import { PlatformaticApplication, PlatformaticComposerConfig } from '@platformatic/composer'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApplication<PlatformaticComposerConfig>
  }
}
`

      const README = `
# Platformatic Composer API

This is a generated [Platformatic Composer](https://docs.platformatic.dev/docs/composer/overview) application.

## Requirements

Platformatic supports macOS, Linux and Windows ([WSL](https://docs.microsoft.com/windows/wsl/) recommended).
You'll need to have [Node.js](https://nodejs.org/) >= v18.8.0 or >= v20.6.0

## Setup

1. Install dependencies:

\`\`\`bash
npm install
\`\`\`

## Usage

Run the API with:

\`\`\`bash
npm start
\`\`\`

### Explore
- ⚡ The Platformatic Composer server is running at http://localhost:3042/
- 📔 View the REST API's Swagger documentation at http://localhost:3042/documentation/      
`

      this.addFile({ path: '', file: 'plt-env.d.ts', contents: PLT_ENVIRONMENT_TEMPLATE })
      this.addFile({ path: '', file: 'README.md', contents: README })
    }
  }

  setRuntime (runtime) {
    this.runtime = runtime
  }
}
