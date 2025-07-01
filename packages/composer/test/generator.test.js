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
  assert.equal(svc.module, '@platformatic/composer')
})

test('generate correct .env file', async t => {
  const svc = new Generator()
  await svc.prepare()
  {
    const dotEnvFile = svc.getFileObject('.env')
    assert.equal(
      dotEnvFile.contents,
      [
        'PLT_SERVER_HOSTNAME=0.0.0.0',
        'PLT_SERVER_LOGGER_LEVEL=info',
        'PORT=3042',
        'PLT_TYPESCRIPT=false',
        'PLT_EXAMPLE_ORIGIN=http://127.0.0.1:3043',
        ''
      ].join('\n')
    )
  }
})

test('have @platformatic/composer dependency', async t => {
  const svc = new Generator()
  await svc.prepare()
  const packageJsonFileObject = svc.getFileObject('package.json')
  const contents = JSON.parse(packageJsonFileObject.contents)
  assert.ok(contents.dependencies['@platformatic/composer'])
})

test('have plt-env.d.ts file', async t => {
  const svc = new Generator()
  await svc.prepare()

  const ENVIRONMENT_TEMPLATE = `
import { FastifyInstance } from 'fastify'
import { PlatformaticApplication, PlatformaticComposerConfig } from '@platformatic/composer'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApplication<PlatformaticComposerConfig>
  }
}
`
  const environment = svc.getFileObject('plt-env.d.ts')
  assert.equal(ENVIRONMENT_TEMPLATE, environment.contents)
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
    `https://schemas.platformatic.dev/@platformatic/composer/${svc.platformaticVersion}.json`
  )
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

  assert.strictEqual(contents.plugins, undefined)
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
    PLT_MY_SERVICE_TYPESCRIPT: false,
    PLT_MY_SERVICE_EXAMPLE_ORIGIN: 'http://127.0.0.1:3043'
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
  assert.strictEqual(configFileContents.server, undefined)
})

test('runtime context do not generate .env file', async t => {
  const svc = new Generator()
  svc.setConfig({
    isRuntimeContext: true,
    serviceName: 'my-service'
  })

  await svc.prepare()

  const configFile = svc.getFileObject('platformatic.json')
  const configFileContents = JSON.parse(configFile.contents)
  assert.strictEqual(configFileContents.server, undefined)
})
