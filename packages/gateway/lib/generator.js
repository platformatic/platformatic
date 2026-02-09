import { Generator as ServiceGenerator } from '@platformatic/service'

export class Generator extends ServiceGenerator {
  constructor (opts) {
    super({
      ...opts,
      module: '@platformatic/gateway'
    })
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

  async _beforePrepare () {
    if (this.config.isUpdating) {
      return
    }

    await super._beforePrepare()

    this.addEnvVars(
      {
        PLT_EXAMPLE_ORIGIN: 'http://127.0.0.1:3043'
      },
      { overwrite: false, default: true }
    )

    this.config.dependencies = {
      '@platformatic/gateway': `^${this.platformaticVersion}`
    }
  }

  async _afterPrepare () {
    if (this.config.isUpdating) {
      return
    }

    await super._afterPrepare()
    const PLT_ENVIRONMENT_TEMPLATE = `
import { type FastifyInstance } from 'fastify'
import { PlatformaticApplication, PlatformaticGatewayConfig } from '@platformatic/gateway'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApplication<PlatformaticGatewayConfig>
  }
}
`

    const README = `
# Platformatic Gateway API

This is a generated [Platformatic Gateway](https://docs.platformatic.dev/docs/gateway/overview) application.

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
- ⚡ The Platformatic Gateway server is running at http://localhost:3042/
- 📔 View the REST API's Swagger documentation at http://localhost:3042/documentation/      
`

    this.addFile({ path: '', file: 'plt-env.d.ts', contents: PLT_ENVIRONMENT_TEMPLATE })
    this.addFile({ path: '', file: 'README.md', contents: README })
  }

  async _getConfigFileContents () {
    const config = await super._getConfigFileContents()
    delete config.service
    config.$schema = `https://schemas.platformatic.dev/@platformatic/gateway/${this.platformaticVersion}.json`

    config.gateway = {
      applications: [
        {
          id: 'example',
          origin: `{${this.getEnvVarName('PLT_EXAMPLE_ORIGIN')}}`,
          openapi: {
            url: '/documentation/json'
          }
        }
      ],
      refreshTimeout: 1000
    }

    if (this.runtime !== null) {
      config.gateway.applications = this.runtime.applications
        .filter(applicationMeta => applicationMeta.application.module !== '@platformatic/gateway')
        .map(applicationMeta => {
          return {
            id: applicationMeta.name
          }
        })
    }

    return config
  }
}
