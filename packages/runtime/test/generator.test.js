'use strict'

const { describe, test } = require('node:test')
const assert = require('node:assert')
const { RuntimeGenerator } = require('../lib/generator/runtime-generator')
const { ServiceGenerator } = require('../../service/lib/generator/service-generator')
const { ComposerGenerator } = require('../../composer/lib/generator/composer-generator')
const { join } = require('node:path')
describe('Generator', () => {
  test('should create a runtime with 2 services', async () => {
    const rg = new RuntimeGenerator({
      targetDirectory: '/tmp/runtime',
      type: 'runtime'
    })

    // adding one service
    const firstService = new ServiceGenerator()
    rg.addService(firstService, 'first-service')

    // adding another service
    const secondService = new ServiceGenerator()
    rg.addService(secondService, 'second-service')

    rg.setEntryPoint('first-service')

    rg.setConfig({
      port: 3043
    })

    const output = await rg.prepare()

    assert.deepEqual(output, {
      targetDirectory: '/tmp/runtime',
      env: {
        PLT_SERVER_HOSTNAME: '0.0.0.0',
        PLT_SERVER_LOGGER_LEVEL: 'info',
        PORT: 3043
      }
    })

    // should list only runtime files
    const runtimeFileList = rg.listFiles()
    assert.deepEqual(runtimeFileList, ['package.json', 'platformatic.runtime.json', '.env', '.gitignore'])

    // services have correct target directory
    assert.equal(firstService.targetDirectory, join(rg.targetDirectory, 'services', firstService.config.serviceName))
    assert.equal(secondService.targetDirectory, join(rg.targetDirectory, 'services', secondService.config.serviceName))
  })

  test('should create a runtime with 1 service and 1 db', async () => {
    const rg = new RuntimeGenerator({
      targetDirectory: '/tmp/runtime',
      type: 'runtime'
    })

    // adding one service
    const firstService = new ServiceGenerator()
    firstService.setConfig({
      env: {
        SERVICE_1: 'foo'
      }
    })
    rg.addService(firstService, 'first-service')

    // adding another service
    const secondService = new ServiceGenerator()
    secondService.setConfig({
      env: {
        SERVICE_2: 'foo'
      }
    })
    rg.addService(secondService, 'second-service')

    rg.setEntryPoint('first-service')

    rg.setConfig({
      port: 3043
    })

    const output = await rg.prepare()

    assert.deepEqual(output, {
      targetDirectory: '/tmp/runtime',
      env: {
        PLT_SERVER_HOSTNAME: '0.0.0.0',
        PLT_SERVER_LOGGER_LEVEL: 'info',
        PORT: 3043
      }
    })

    // should list only runtime files
    const runtimeFileList = rg.listFiles()
    assert.deepEqual(runtimeFileList, ['package.json', 'platformatic.runtime.json', '.env', '.gitignore'])

    // services have correct target directory
    assert.equal(firstService.targetDirectory, join(rg.targetDirectory, 'services', firstService.config.serviceName))
    assert.equal(secondService.targetDirectory, join(rg.targetDirectory, 'services', secondService.config.serviceName))
  })

  test('should create a runtime with 2 services and 2 composers', async () => {
    const rg = new RuntimeGenerator({
      targetDirectory: '/tmp/runtime',
      type: 'runtime'
    })

    // adding one service
    const firstService = new ServiceGenerator()
    rg.addService(firstService, 'first-service')

    // adding another service
    const secondService = new ServiceGenerator()
    rg.addService(secondService, 'second-service')

    // adding composers
    const firstComposer = new ComposerGenerator()
    rg.addService(firstComposer, 'first-composer')
    const secondComposer = new ComposerGenerator()
    rg.addService(secondComposer, 'second-composer')

    rg.setEntryPoint('first-service')

    rg.setConfig({
      port: 3043
    })

    await rg.prepare()

    // double check config files
    const firstComposerConfigFile = firstComposer.getFileObject('platformatic.composer.json')
    const firstComposerConfigFileJson = JSON.parse(firstComposerConfigFile.contents)
    assert.deepEqual(firstComposerConfigFileJson.composer.services, [
      {
        id: 'first-service',
        openapi: {
          url: '/documentation/json',
          prefix: '/first-service'
        }
      },
      {
        id: 'second-service',
        openapi: {
          url: '/documentation/json',
          prefix: '/second-service'
        }
      }
    ])

    const secondComposerConfigFile = secondComposer.getFileObject('platformatic.composer.json')
    const secondComposerConfigFileJson = JSON.parse(secondComposerConfigFile.contents)
    assert.deepEqual(secondComposerConfigFileJson.composer.services, [
      {
        id: 'first-service',
        openapi: {
          url: '/documentation/json',
          prefix: '/first-service'
        }
      },
      {
        id: 'second-service',
        openapi: {
          url: '/documentation/json',
          prefix: '/second-service'
        }
      }
    ])
  })
})
