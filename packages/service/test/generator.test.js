'use strict'

const assert = require('node:assert')
const { describe, test } = require('node:test')
const { ServiceGenerator } = require('../lib/generator/service-generator')

describe('generator', () => {
  test('generate correct .env file', async (t) => {
    const svc = new ServiceGenerator()
    await svc.prepare()
    {
      const dotEnvFile = svc.getFileObject('.env')
      assert.equal(dotEnvFile.contents, 'PLT_SERVER_HOSTNAME=0.0.0.0\nPLT_SERVER_LOGGER_LEVEL=info\nPORT=3042\n')
    }

    {
      svc.setConfig({
        typescript: true,
        plugin: true
      })

      await svc.prepare()

      const configFile = svc.getFileObject('platformatic.service.json')
      const configFileJson = JSON.parse(configFile.contents)
      assert.equal(configFileJson.plugins.typescript, true)
    }
  })

  test('have @platformatic/service dependency', async (t) => {
    const svc = new ServiceGenerator()
    await svc.prepare()
    const packageJsonFileObject = svc.getFileObject('package.json')
    const contents = JSON.parse(packageJsonFileObject.contents)
    assert.equal(contents.dependencies['@platformatic/service'], contents.dependencies.platformatic)
  })

  test('config', async (t) => {
    const svc = new ServiceGenerator()
    svc.setConfig({
      plugin: true,
      typescript: true
    })
    await svc.prepare()
    const platformaticConfigFile = svc.getFileObject('platformatic.service.json')
    const contents = JSON.parse(platformaticConfigFile.contents)
    assert.equal(contents.$schema, `https://platformatic.dev/schemas/v${svc.platformaticVersion}/service`)
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
      const svc = new ServiceGenerator()
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
      assert.deepEqual(svc.config.env, {})
    })

    test('should not have server.config', async (t) => {
      const svc = new ServiceGenerator()
      svc.setConfig({
        isRuntimeContext: true,
        serviceName: 'my-service'
      })

      await svc.prepare()

      const configFile = svc.getFileObject('platformatic.service.json')
      const configFileContents = JSON.parse(configFile.contents)
      assert.strictEqual(undefined, configFileContents.server)
    })
  })
})
