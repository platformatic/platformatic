import { Generator as ServiceGenerator } from '@platformatic/service'

export class Generator extends ServiceGenerator {
  constructor (opts) {
    super({
      ...opts,
      module: '@platformatic/composer'
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
      '@platformatic/composer': `^${this.platformaticVersion}`
    }
  }

  async _afterPrepare () {
    if (this.config.isUpdating) {
      return
    }

    await super._afterPrepare()
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

  async _getConfigFileContents () {
    const config = await super._getConfigFileContents()
    delete config.service
    config.$schema = `https://schemas.platformatic.dev/@platformatic/composer/${this.platformaticVersion}.json`

    config.composer = {
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
    }

    if (this.runtime !== null) {
      config.composer.services = this.runtime.services
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

    return config
  }
}
