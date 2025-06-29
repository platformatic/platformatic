'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { Generator } = require('../lib/generator')

const { MockAgent, setGlobalDispatcher } = require('undici')

const mockAgent = new MockAgent()
setGlobalDispatcher(mockAgent)
mockAgent.disableNetConnect()

test('should export a Generator property', async () => {
  const svc = new Generator()
  assert.equal(svc.module, '@platformatic/service')
})
test('generate correct .env file', async t => {
  const svc = new Generator()
  await svc.prepare()
  {
    const dotEnvFile = svc.getFileObject('.env')
    const expectedDotEnvFile =
      'PLT_SERVER_HOSTNAME=0.0.0.0\n' + 'PLT_SERVER_LOGGER_LEVEL=info\n' + 'PORT=3042\n' + 'PLT_TYPESCRIPT=false\n'

    assert.equal(dotEnvFile.contents, expectedDotEnvFile)
  }

  {
    svc.setConfig({
      typescript: true
    })

    await svc.prepare()

    const configFile = svc.getFileObject('platformatic.json')
    const configFileJson = JSON.parse(configFile.contents)
    assert.equal(configFileJson.plugins.typescript, '{PLT_TYPESCRIPT}')
  }
})

test('generate correct README file', async t => {
  const svc = new Generator()
  await svc.prepare()

  svc.setConfig({
    typescript: true
  })

  await svc.prepare()

  const readme = svc.getFileObject('README.md')
  assert.ok(readme.contents.includes('Platformatic Service API'))
})

test('have platformatic dependencies', async t => {
  const svc = new Generator()
  await svc.prepare()
  const packageJsonFileObject = svc.getFileObject('package.json')
  const contents = JSON.parse(packageJsonFileObject.contents)
  assert.equal(contents.dependencies.platformatic, undefined)
  assert.ok(contents.dependencies['@platformatic/service'])
})

test('config', async t => {
  const svc = new Generator()
  svc.setConfig({
    typescript: true
  })
  await svc.prepare()
  const platformaticConfigFile = svc.getFileObject('platformatic.json')
  const contents = JSON.parse(platformaticConfigFile.contents)
  assert.equal(
    contents.$schema,
    `https://schemas.platformatic.dev/@platformatic/service/${svc.platformaticVersion}.json`
  )
  assert.deepEqual(contents.server, {
    hostname: '{PLT_SERVER_HOSTNAME}',
    port: '{PORT}',
    logger: { level: '{PLT_SERVER_LOGGER_LEVEL}' }
  })

  assert.deepEqual(contents.plugins, {
    paths: [{ path: './plugins', encapsulate: false }, './routes'],
    typescript: '{PLT_TYPESCRIPT}'
  })
})

test('support packages', async t => {
  {
    const svc = new Generator()
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
      plugin: false,
      serviceName: 'my-service'
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
            foobar: '{PLT_MY_SERVICE_FST_PLUGIN_STATIC_FOOBAR}'
          }
        }
      ]
    })

    assert.equal(svc.config.env.PLT_MY_SERVICE_FST_PLUGIN_STATIC_FOOBAR, 123)
  }
  {
    // with standard platformatic plugin
    const svc = new Generator()
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
      typescript: '{PLT_TYPESCRIPT}',
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
  const svc = new Generator()

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
      type: 'number',
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
  const svc = new Generator()
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

test('runtime context should have env prefix', async t => {
  const svc = new Generator()
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
    PLT_MY_SERVICE_BAZ: 'baz',
    PLT_MY_SERVICE_TYPESCRIPT: false
  })
})

test('runtime context should not have server.config', async t => {
  const svc = new Generator()
  svc.setConfig({
    isRuntimeContext: true,
    serviceName: 'my-service'
  })

  await svc.prepare()

  const configFile = svc.getFileObject('platformatic.json')
  const configFileContents = JSON.parse(configFile.contents)
  assert.strictEqual(undefined, configFileContents.server)
})

test('runtime context should not generate .env file', async t => {
  const svc = new Generator()
  svc.setConfig({
    isRuntimeContext: true,
    serviceName: 'my-service'
  })

  await svc.prepare()

  const configFile = svc.getFileObject('platformatic.json')
  const configFileContents = JSON.parse(configFile.contents)
  assert.strictEqual(undefined, configFileContents.server)
})
