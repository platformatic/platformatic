'use strict'

const assert = require('node:assert')
const { describe, test } = require('node:test')
const { ComposerGenerator } = require('../lib/generator/composer-generator')

describe('generator', () => {
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

      const configFile = svc.getFileObject('platformatic.composer.json')
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

  test('config', async (t) => {
    const svc = new ComposerGenerator()
    svc.setConfig({
      plugin: true,
      typescript: true
    })
    await svc.prepare()
    const platformaticConfigFile = svc.getFileObject('platformatic.composer.json')
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

      const configFile = svc.getFileObject('platformatic.composer.json')
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

      const configFile = svc.getFileObject('platformatic.composer.json')
      const configFileContents = JSON.parse(configFile.contents)
      assert.strictEqual(configFileContents.server, undefined)
    })

    test('should add runtime services in config', async (t) => {
      const svc = new ComposerGenerator()
      svc.setConfig({
        isRuntimeContext: true,
        serviceName: 'my-service'
      })
      svc.addRuntimeService('foo-service')
      svc.addRuntimeService('db-service')
      await svc.prepare()

      const configFile = svc.getFileObject('platformatic.composer.json')
      const configFileContents = JSON.parse(configFile.contents)
      assert.deepEqual(configFileContents.composer.services, [
        {
          id: 'foo-service',
          openapi: {
            url: '/documentation/json',
            prefix: '/foo-service'
          }
        },
        {
          id: 'db-service',
          openapi: {
            url: '/documentation/json',
            prefix: '/db-service'
          }
        }
      ])
    })
  })
})
