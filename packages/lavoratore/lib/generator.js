import { BaseGenerator } from '@platformatic/generators'

const workerFileJS = `
export default {
  async fetch (request, env, ctx) {
    return Response.json({ hello: env.GREETING ?? 'world' })
  }
}
`

const workerFileTS = `
interface Env {
  GREETING?: string
}

export default {
  async fetch (request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return Response.json({ hello: env.GREETING ?? 'world' })
  }
} satisfies ExportedHandler<Env>
`

export class Generator extends BaseGenerator {
  constructor (opts = {}) {
    super({
      ...opts,
      module: '@platformatic/lavoratore'
    })
  }

  async prepareQuestions () {
    await super.prepareQuestions()

    if (!this.config.skipTypescript) {
      this.questions.push({
        type: 'select',
        name: 'typescript',
        message: 'Do you want to use TypeScript?',
        default: false,
        choices: [
          { name: 'yes', value: true },
          { name: 'no', value: false }
        ]
      })
    }
  }

  async prepare () {
    await this.getPlatformaticVersion()

    if (this.config.isUpdating) {
      return
    }

    const main = this.config.typescript ? 'src/index.ts' : 'src/index.js'
    const devDependencies = { wrangler: '^4.0.0' }

    if (this.config.typescript) {
      devDependencies['@cloudflare/workers-types'] = '^4.0.0'
      devDependencies.typescript = '^5.0.0'

      this.addFile({
        path: '',
        file: 'tsconfig.json',
        contents: JSON.stringify(
          {
            compilerOptions: {
              target: 'es2022',
              module: 'es2022',
              moduleResolution: 'bundler',
              strict: true,
              noEmit: true,
              types: ['@cloudflare/workers-types']
            }
          },
          null,
          2
        )
      })
    }

    this.addFile({
      path: 'src',
      file: this.config.typescript ? 'index.ts' : 'index.js',
      contents: (this.config.typescript ? workerFileTS : workerFileJS).trim() + '\n'
    })

    this.addFile({
      path: '',
      file: 'wrangler.json',
      contents: JSON.stringify(
        {
          name: this.config.applicationName,
          main,
          compatibility_date: new Date().toISOString().slice(0, 10)
        },
        null,
        2
      )
    })

    this.addFile({
      path: '',
      file: 'package.json',
      contents: JSON.stringify(
        {
          name: `${this.config.applicationName}`,
          version: '0.1.0',
          type: 'module',
          scripts: {
            deploy: 'wrangler deploy'
          },
          dependencies: {
            '@platformatic/lavoratore': `^${this.platformaticVersion}`
          },
          devDependencies
        },
        null,
        2
      )
    })

    this.addFile({
      path: '',
      file: 'watt.json',
      contents: JSON.stringify(
        {
          $schema: `https://schemas.platformatic.dev/@platformatic/lavoratore/${this.platformaticVersion}.json`
        },
        null,
        2
      )
    })

    return {
      targetDirectory: this.targetDirectory,
      env: this.config.env
    }
  }

  async _getConfigFileContents () {}
}
