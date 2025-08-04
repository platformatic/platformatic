import { BaseGenerator } from '@platformatic/generators'
import { join } from 'node:path'

const JS_PLUGIN_WITH_TYPES_SUPPORT = `\
'use strict'

/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.decorate('example', 'foobar')
}
`

const TS_PLUGIN_WITH_TYPES_SUPPORT = `\
import { type FastifyInstance, type FastifyPluginOptions } from 'fastify'

export default async function (fastify: FastifyInstance, opts: FastifyPluginOptions) {
  fastify.decorate('example', 'foobar')
}
`

const JS_ROUTES_WITH_TYPES_SUPPORT = `\
'use strict'

/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.get('/example', async (request, reply) => {
    return { hello: fastify.example }
  })
}
`

const TS_ROUTES_WITH_TYPES_SUPPORT = `\
import { type FastifyInstance, type FastifyPluginOptions } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    example: string
  }
}

export default async function (fastify: FastifyInstance, opts: FastifyPluginOptions) {
  fastify.get('/example', async (request, reply) => {
    return { hello: fastify.example }
  })
}
`

const TEST_ROUTES_JS = `\
'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { getServer } = require('../helper')

test('example', async (t) => {
  const server = await getServer(t)
  const res = await server.inject({
    method: 'GET',
    url: '/example'
  })

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(res.json(), {
    hello: 'foobar'
  })
})
`

const TEST_PLUGIN_JS = `\
'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { getServer } = require('../helper')

test('example decorator', async (t) => {
  const server = await getServer(t)

  assert.strictEqual(server.example, 'foobar')
})
`

const TEST_ROUTES_TS = `\
import test from 'node:test'
import assert from 'node:assert'
import { getServer } from '../helper'

test('root', async (t) => {
  const server = await getServer(t)
  const res = await server.inject({
    method: 'GET',
    url: '/example'
  })

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(res.json(), {
    hello: 'foobar'
  })
})
`

const TEST_PLUGIN_TS = `\
import test from 'node:test'
import assert from 'node:assert'
import { getServer } from '../helper'

test('example decorator', async (t) => {
  const server = await getServer(t)

  assert.strictEqual(server.example, 'foobar')
})
`

const TEST_HELPER_JS = `
'use strict'

const { join } = require('node:path')
const { readFile } = require('node:fs/promises')
const { buildServer } = require('$__MOD__')
$__REQUIRES__

async function getServer (t) {
$__PRE__
  const config = JSON.parse(await readFile(join(__dirname, '..', 'watt.json'), 'utf8'))
  // Add your config customizations here. For example you want to set
  // all things that are set in the config file to read from an env variable
  config.server ||= {}
  config.server.logger ||= {}
  config.watch = false
$__CONFIG__
  // Add your config customizations here
  const server = await buildServer(config)
  t.after(() => server.close())
$__POST__
  return server
}

module.exports.getServer = getServer
`

const TEST_HELPER_TS = `
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { buildServer } from '$__MOD__'
import { test } from 'node:test'
$__REQUIRES__

type testfn = Parameters<typeof test>[0]
type TestContext = Parameters<Exclude<testfn, undefined>>[0]

export async function getServer (t: TestContext) {
$__PRE__
  // We go up two folder because this files executes in the dist folder
  const config = JSON.parse(await readFile(join(__dirname, '..', '..', 'watt.json'), 'utf8'))
  // Add your config customizations here. For example you want to set
  // all things that are set in the config file to read from an env variable
  config.server ||= {}
  config.server.logger ||= {}
  config.server.logger.level = 'warn'
  config.watch = false
$__CONFIG__
  // Add your config customizations here
  const server = await buildServer(config)
  t.after(() => server.close())
$__POST__
  return server
}
  `

const TS_CONFIG = `
{
  compilerOptions: {
    module: 'commonjs',
    esModuleInterop: true,
    target: 'es2020',
    sourceMap: true,
    pretty: true,
    noEmitOnError: true,
    incremental: true,
    strict: true,
    outDir: 'dist',
    skipLibCheck: true
  },
  watchOptions: {
    watchFile: 'fixedPollingInterval',
    watchDirectory: 'fixedPollingInterval',
    fallbackPolling: 'dynamicPriority',
    synchronousWatchDirectory: true,
    excludeDirectories: ['**/node_modules', 'dist']
  }
}
`

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

export function applyTestHelperCustomizations (testHelper, mod, customizations) {
  return testHelper
    .replaceAll('$__MOD__', mod || '@platformatic/service')
    .replaceAll('$__REQUIRES__', customizations.requires || '')
    .replaceAll('$__PRE__', customizations.pre || '')
    .replaceAll('$__CONFIG__', customizations.config || '')
    .replaceAll('$__POST__', customizations.post || '')
}

export class Generator extends BaseGenerator {
  constructor (opts = {}) {
    super({
      module: '@platformatic/service',
      ...opts
    })
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

  getDefaultConfig () {
    const defaultBaseConfig = super.getDefaultConfig()

    return {
      ...defaultBaseConfig,
      plugin: true,
      tests: true
    }
  }

  async prepareQuestions () {
    await super.prepareQuestions()

    if (!this.config.skipTypescript) {
      this.questions.push({
        type: 'list',
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

  async _beforePrepare () {
    if (this.config.isUpdating) {
      return
    }

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

  async _afterPrepare () {
    // if we are NOT updating, create env and files, otherwise leave as it is
    if (this.config.isUpdating) {
      return
    }

    if (this.config.typescript) {
      this.addFile({ path: '', file: 'tsconfig.json', contents: TS_CONFIG })
    }

    this.addFile({ path: '', file: 'plt-env.d.ts', contents: PLT_ENVIRONMENT_TEMPLATE })
    this.addFile({ path: '', file: 'README.md', contents: README })

    if (this.config.plugin) {
      // create plugin
      this.files.push({
        path: 'plugins',
        file: this.config.typescript ? 'example.ts' : 'example.js',
        contents: this.config.typescript ? TS_PLUGIN_WITH_TYPES_SUPPORT : JS_PLUGIN_WITH_TYPES_SUPPORT
      })

      this.files.push({
        path: 'routes',
        file: this.config.typescript ? 'root.ts' : 'root.js',
        contents: this.config.typescript ? TS_ROUTES_WITH_TYPES_SUPPORT : JS_ROUTES_WITH_TYPES_SUPPORT
      })

      if (this.config.tests) {
        if (this.config.typescript) {
          this.files.push({
            path: 'test',
            file: 'helper.ts',
            contents: applyTestHelperCustomizations(TEST_HELPER_TS, this.module, this.testHelperCustomizations ?? {})
          })
          this.files.push({
            path: join('test', 'plugins'),
            file: 'example.test.ts',
            contents: TEST_PLUGIN_TS
          })
          this.files.push({
            path: join('test', 'routes'),
            file: 'root.test.ts',
            contents: TEST_ROUTES_TS
          })
        } else {
          this.files.push({
            path: 'test',
            file: 'helper.js',
            contents: applyTestHelperCustomizations(TEST_HELPER_JS, this.module, this.testHelperCustomizations ?? {})
          })
          this.files.push({
            path: join('test', 'plugins'),
            file: 'example.test.js',
            contents: TEST_PLUGIN_JS
          })
          this.files.push({
            path: join('test', 'routes'),
            file: 'root.test.js',
            contents: TEST_ROUTES_JS
          })
        }
      }
    }
  }

  async _getConfigFileContents () {
    const config = {
      $schema: `https://schemas.platformatic.dev/@platformatic/service/${this.platformaticVersion}.json`,
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

    if (!this.config.isRuntimeContext) {
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
