'use strict'

const assert = require('node:assert')
const { readFile } = require('node:fs/promises')
const { describe, test } = require('node:test')
const { ServiceGenerator, Generator } = require('../lib/generator/service-generator')
const { join } = require('node:path')

describe('generator', () => {
  test('should export a Generator property', async () => {
    const svc = new Generator()
    assert.equal(svc.module, '@platformatic/service')
  })
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

      const configFile = svc.getFileObject('platformatic.json')
      const configFileJson = JSON.parse(configFile.contents)
      assert.equal(configFileJson.plugins.typescript, true)
    }
  })

  test('generate correct README file', async (t) => {
    const svc = new ServiceGenerator()
    await svc.prepare()

    svc.setConfig({
      typescript: true,
      plugin: true
    })

    await svc.prepare()

    const readme = svc.getFileObject('README.md')
    const contentsReadme = await readFile(join(__dirname, '..', 'lib', 'generator', 'README.md'), 'utf8')
    assert.equal(readme.contents, contentsReadme)
  })

  test('have platformatic dependencies', async (t) => {
    const svc = new ServiceGenerator()
    await svc.prepare()
    const packageJsonFileObject = svc.getFileObject('package.json')
    const contents = JSON.parse(packageJsonFileObject.contents)
    assert.equal(contents.dependencies.platformatic, contents.dependencies.platformatic)
    assert.equal(contents.dependencies['@platformatic/service'], contents.dependencies.platformatic)
  })

  test('config', async (t) => {
    const svc = new ServiceGenerator()
    svc.setConfig({
      plugin: true,
      typescript: true
    })
    await svc.prepare()
    const platformaticConfigFile = svc.getFileObject('platformatic.json')
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

  test('support packages', async (t) => {
    {
      const svc = new ServiceGenerator()
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
        serviceName: 'my-service'
      })
      svc.addPackage(packageDefinitions[0])
      await svc.prepare()

      const platformaticConfigFile = svc.getFileObject('platformatic.json')
      const contents = JSON.parse(platformaticConfigFile.contents)

      assert.deepEqual(contents.plugins, {
        packages: [
          {
            name: '@fastify/compress',
            options: {
              threshold: 1,
              foobar: `{PLT_MY_SERVICE_FST_PLUGIN_STATIC_FOOBAR}`
            }
          }
        ]
      })

      assert.equal(svc.config.env.PLT_MY_SERVICE_FST_PLUGIN_STATIC_FOOBAR, 123)
    }
    {
      // with standard platformatic plugin
      const svc = new ServiceGenerator()
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
      svc.addPackage(packageDefinitions[0])
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

  test('should return config fields', async () => {
    const svc = new ServiceGenerator()

    assert.deepEqual(svc.getConfigFieldsDefinitions(), [
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
        tyoe: 'number',
        configValue: 'port'
      }
    ])

    // empty array in runtime context
    svc.setConfig({
      isRuntimeContext: true
    })
    assert.deepEqual(svc.getConfigFieldsDefinitions(), [])
  })

  test('should set config fields', async () => {
    const svc = new ServiceGenerator()
    svc.setConfig({
      isRuntimeContext: false
    })
    const values = [
      {
        // existing field
        var: 'PLT_SERVER_HOSTNAME',
        configValue: 'hostname',
        value: '127.0.0.123'
      },
      {
        // existing field without configValue
        var: 'PLT_SERVER_LOGGER_LEVEL',
        configValue: '',
        value: 'debug'
      },
      {
        // non-existing field
        var: 'PLT_NOT_EXISTING',
        configValue: 'foobar',
        value: 'baz'
      }

    ]
    svc.setConfigFields(values)

    assert.equal(svc.config.hostname, '127.0.0.123')
    assert.deepEqual(svc.config.env, {
      PLT_SERVER_HOSTNAME: '127.0.0.123',
      PLT_SERVER_LOGGER_LEVEL: 'debug'
    })

    assert.equal(undefined, svc.config.foobar)
    assert.equal(undefined, svc.config.env.PLT_NOT_EXISTING)
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
      
      await svc.prepare()

      // no env file is generated
      assert.equal(null, svc.getFileObject('.env'))
      assert.deepEqual(svc.config.env, {
        PLT_MY_SERVICE_FOO: 'bar',
        PLT_MY_SERVICE_BAZ: 'baz'
      })
    })

    test('should not have server.config', async (t) => {
      const svc = new ServiceGenerator()
      svc.setConfig({
        isRuntimeContext: true,
        serviceName: 'my-service'
      })

      await svc.prepare()

      const configFile = svc.getFileObject('platformatic.json')
      const configFileContents = JSON.parse(configFile.contents)
      assert.strictEqual(undefined, configFileContents.server)
    })

    test('do not generate .env file', async (t) => {
      const svc = new ServiceGenerator()
      svc.setConfig({
        isRuntimeContext: true,
        serviceName: 'my-service'
      })

      await svc.prepare()

      const configFile = svc.getFileObject('platformatic.json')
      const configFileContents = JSON.parse(configFile.contents)
      assert.strictEqual(undefined, configFileContents.server)
    })
  })
})
