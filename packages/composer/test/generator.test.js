'use strict'

const assert = require('node:assert')
const { describe, test } = require('node:test')
const { ComposerGenerator, Generator } = require('../lib/generator/composer-generator')

describe('generator', () => {
  test('should export a Generator property', async () => {
    const svc = new Generator()
    assert.equal(svc.module, '@platformatic/composer')
  })
  test('generate correct .env file', async (t) => {
    const svc = new ComposerGenerator()
    await svc.prepare()
    {
      const dotEnvFile = svc.getFileObject('.env')
      assert.equal(dotEnvFile.contents, 'PLT_SERVER_HOSTNAME=0.0.0.0\nPLT_SERVER_LOGGER_LEVEL=info\nPORT=3042\nPLT_EXAMPLE_ORIGIN=http://127.0.0.1:3043\n')
    }

    {
      svc.setConfig({
        typescript: true,
        plugin: true
      })

      await svc.prepare()

      const configFile = svc.getFileObject('platformatic.json')
      const configFileJson = JSON.parse(configFile.contents)
      assert.equal(configFileJson.plugins.typescript, true)
    }
  })

  test('have @platformatic/composer dependency', async (t) => {
    const svc = new ComposerGenerator()
    await svc.prepare()
    const packageJsonFileObject = svc.getFileObject('package.json')
    const contents = JSON.parse(packageJsonFileObject.contents)
    assert.equal(contents.dependencies['@platformatic/composer'], contents.dependencies.platformatic)
  })

  test('have global.d.ts file', async (t) => {
    const svc = new ComposerGenerator()
    await svc.prepare()

    const GLOBAL_TYPES_TEMPLATE = `
import { FastifyInstance } from 'fastify'
import { PlatformaticApp, PlatformaticComposerConfig } from '@platformatic/composer'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApp<PlatformaticComposerConfig>
  }
}
`
    const globalts = svc.getFileObject('global.d.ts')
    assert.equal(GLOBAL_TYPES_TEMPLATE, globalts.contents)
  })

  test('config', async (t) => {
    const svc = new ComposerGenerator()
    svc.setConfig({
      plugin: true,
      typescript: true
    })
    await svc.prepare()
    const platformaticConfigFile = svc.getFileObject('platformatic.json')
    const contents = JSON.parse(platformaticConfigFile.contents)
    assert.equal(contents.$schema, `https://platformatic.dev/schemas/v${svc.platformaticVersion}/composer`)
    assert.deepEqual(contents.composer, {
      services: [
        {
          id: 'example',
          origin: '{PLT_EXAMPLE_ORIGIN}',
          openapi: {
            url: '/documentation/json'
          }
        }
      ],
      refreshTimeout: 1000
    })
    assert.deepEqual(contents.server, {
      hostname: '{PLT_SERVER_HOSTNAME}',
      port: '{PORT}',
      logger: { level: '{PLT_SERVER_LOGGER_LEVEL}' }
    })

    assert.deepEqual(contents.plugins, {
      paths: [{ path: './plugins', encapsulate: false }, './routes'],
      typescript: true
    })
  })

  test('support packages', async (t) => {
    {
      const svc = new ComposerGenerator()
      const packageDefinitions = [
        {
          name: '@fastify/compress',
          options: [
            {
              path: 'threshold',
              value: '1',
              type: 'number'
            },
            {
              path: 'foobar',
              value: '123',
              type: 'number',
              name: 'FST_PLUGIN_STATIC_FOOBAR'
            }
          ]
        }
      ]
      svc.setConfig({
        isRuntimeContext: true,
        serviceName: 'my-composer'
      })
      await svc.addPackage(packageDefinitions[0])
      await svc.prepare()

      const platformaticConfigFile = svc.getFileObject('platformatic.json')
      const contents = JSON.parse(platformaticConfigFile.contents)

      assert.deepEqual(contents.plugins, {
        packages: [
          {
            name: '@fastify/compress',
            options: {
              threshold: 1,
              foobar: '{PLT_MY_COMPOSER_FST_PLUGIN_STATIC_FOOBAR}'
            }
          }
        ]
      })

      assert.equal(svc.config.env.PLT_MY_COMPOSER_FST_PLUGIN_STATIC_FOOBAR, 123)
    }
    {
      // with standard platformatic plugin
      const svc = new ComposerGenerator()
      svc.setConfig({
        plugin: true
      })
      const packageDefinitions = [
        {
          name: '@fastify/compress',
          options: [
            {
              path: 'threshold',
              value: '1',
              type: 'number'
            }
          ]
        }
      ]
      await svc.addPackage(packageDefinitions[0])
      await svc.prepare()

      const platformaticConfigFile = svc.getFileObject('platformatic.json')
      const contents = JSON.parse(platformaticConfigFile.contents)

      assert.deepEqual(contents.plugins, {
        paths: [
          {
            encapsulate: false,
            path: './plugins'
          },
          './routes'
        ],
        packages: [
          {
            name: '@fastify/compress',
            options: {
              threshold: 1
            }
          }
        ]
      })
    }
  })

  describe('runtime context', () => {
    test('should have env prefix', async (t) => {
      const svc = new ComposerGenerator()
      svc.setConfig({
        isRuntimeContext: true,
        serviceName: 'my-service',
        env: {
          FOO: 'bar',
          BAZ: 'baz'
        }
      })
      assert.deepEqual(svc.config.env, {
        PLT_MY_SERVICE_FOO: 'bar',
        PLT_MY_SERVICE_BAZ: 'baz'
      })

      await svc.prepare()

      // no env file is generated
      assert.equal(null, svc.getFileObject('.env'))
      assert.deepEqual(svc.config.env, {
        PLT_MY_SERVICE_FOO: 'bar',
        PLT_MY_SERVICE_BAZ: 'baz',
        PLT_MY_SERVICE_EXAMPLE_ORIGIN: 'http://127.0.0.1:3043'
      })
    })

    test('should not have server.config', async (t) => {
      const svc = new ComposerGenerator()
      svc.setConfig({
        isRuntimeContext: true,
        serviceName: 'my-service'
      })

      await svc.prepare()

      const configFile = svc.getFileObject('platformatic.json')
      const configFileContents = JSON.parse(configFile.contents)
      assert.strictEqual(configFileContents.server, undefined)
    })

    test('do not generate .env file', async (t) => {
      const svc = new ComposerGenerator()
      svc.setConfig({
        isRuntimeContext: true,
        serviceName: 'my-service'
      })

      await svc.prepare()

      const configFile = svc.getFileObject('platformatic.json')
      const configFileContents = JSON.parse(configFile.contents)
      assert.strictEqual(configFileContents.server, undefined)
    })
  })
})
