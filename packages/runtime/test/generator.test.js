'use strict'

const { describe, test } = require('node:test')
const assert = require('node:assert')
const { mkdtemp } = require('node:fs/promises')
const { RuntimeGenerator } = require('../lib/generator/runtime-generator')
const { ServiceGenerator } = require('../../service/lib/generator/service-generator')
const { ComposerGenerator } = require('../../composer/lib/generator/composer-generator')
const { join } = require('node:path')
const { tmpdir } = require('node:os')
const { MockAgent, setGlobalDispatcher } = require('undici')
const { safeRemove } = require('@platformatic/utils')

const mockAgent = new MockAgent()
setGlobalDispatcher(mockAgent)
mockAgent.disableNetConnect()

describe('Generator', () => {
  test('should create a runtime with 2 services', async () => {
    const rg = new RuntimeGenerator({
      targetDirectory: '/tmp/runtime',
    })

    // adding one service
    const firstService = new ServiceGenerator()
    rg.addService(firstService, 'first-service')

    // adding another service
    const secondService = new ServiceGenerator()
    rg.addService(secondService, 'second-service')

    rg.setEntryPoint('first-service')

    rg.setConfig({
      port: 3043,
      logLevel: 'debug',
    })

    const output = await rg.prepare()

    assert.deepEqual(output, {
      targetDirectory: '/tmp/runtime',
      env: {
        PLT_FIRST_SERVICE_TYPESCRIPT: false,
        PLT_SECOND_SERVICE_TYPESCRIPT: false,
        PLT_SERVER_HOSTNAME: '127.0.0.1',
        PLT_SERVER_LOGGER_LEVEL: 'debug',
        PLT_MANAGEMENT_API: true,
        PORT: 3043,
      },
    })

    // should list only runtime files
    const runtimeFileList = rg.listFiles()
    assert.deepEqual(runtimeFileList, ['package.json', 'platformatic.json', '.env', '.env.sample', '.gitignore', 'README.md'])

    // services have correct target directory
    assert.equal(firstService.targetDirectory, join(rg.targetDirectory, 'services', firstService.config.serviceName))
    assert.equal(secondService.targetDirectory, join(rg.targetDirectory, 'services', secondService.config.serviceName))
  })

  test('should have a valid package.json', async () => {
    const rg = new RuntimeGenerator({
      name: 'test-runtime',
      targetDirectory: '/tmp/runtime',
    })

    const firstService = new ServiceGenerator()
    firstService.setConfig({
      isRuntimeContext: false,
    })
    rg.addService(firstService, 'first-service')

    rg.setEntryPoint('first-service')

    rg.setConfig({
      port: 3043,
      logLevel: 'debug',
    })

    await rg.prepare()
    const packageJson = JSON.parse(rg.getFileObject('package.json').contents)
    assert.equal(packageJson.name, 'test-runtime')
    assert.deepStrictEqual(packageJson.workspaces, ['services/*'])

    assert.ok(packageJson.dependencies['@platformatic/runtime'])
  })

  test('should have services plugin dependencies in package.json', async () => {
    const rg = new RuntimeGenerator({
      targetDirectory: '/tmp/runtime',
    })

    // adding one service
    const firstService = new ServiceGenerator()
    firstService.setConfig({
      isRuntimeContext: false,
    })
    await firstService.addPackage({
      name: '@fastify/helmet',
      options: [],
    })
    rg.addService(firstService, 'first-service')

    rg.setEntryPoint('first-service')

    rg.setConfig({
      port: 3043,
      logLevel: 'debug',
    })

    const output = await rg.prepare()
    // runtime package.json has the service dependencies
    const packageJson = JSON.parse(rg.getFileObject('package.json').contents)
    assert.equal(packageJson.dependencies['@fastify/helmet'], 'latest')

    assert.deepEqual(output, {
      targetDirectory: '/tmp/runtime',
      env: {
        PLT_FIRST_SERVICE_TYPESCRIPT: false,
        PLT_SERVER_HOSTNAME: '127.0.0.1',
        PLT_MANAGEMENT_API: true,
        PLT_SERVER_LOGGER_LEVEL: 'debug',
        PORT: 3043,
      },
    })
  })

  test('should create a runtime with 1 service and 1 db', async () => {
    const rg = new RuntimeGenerator({
      targetDirectory: '/tmp/runtime',
    })

    // adding one service
    const firstService = new ServiceGenerator()
    firstService.setConfig({
      env: {
        SERVICE_1: 'foo',
      },
    })
    rg.addService(firstService, 'first-service')

    // adding another service
    const secondService = new ServiceGenerator()
    secondService.setConfig({
      env: {
        SERVICE_2: 'foo',
      },
    })
    rg.addService(secondService, 'second-service')

    rg.setEntryPoint('first-service')

    rg.setConfig({
      port: 3043,
    })

    const output = await rg.prepare()

    assert.deepEqual(output, {
      targetDirectory: '/tmp/runtime',
      env: {
        PLT_FIRST_SERVICE_SERVICE_1: 'foo',
        PLT_FIRST_SERVICE_TYPESCRIPT: false,
        PLT_SECOND_SERVICE_SERVICE_2: 'foo',
        PLT_SECOND_SERVICE_TYPESCRIPT: false,
        PLT_SERVER_HOSTNAME: '127.0.0.1',
        PLT_MANAGEMENT_API: true,
        PLT_SERVER_LOGGER_LEVEL: 'info',
        PORT: 3043,
      },
    })

    // should list only runtime files
    const runtimeFileList = rg.listFiles()
    assert.deepEqual(runtimeFileList, ['package.json', 'platformatic.json', '.env', '.env.sample', '.gitignore', 'README.md'])

    // services have correct target directory
    assert.equal(firstService.targetDirectory, join(rg.targetDirectory, 'services', firstService.config.serviceName))
    assert.equal(secondService.targetDirectory, join(rg.targetDirectory, 'services', secondService.config.serviceName))
  })

  test('should create a runtime with 2 services and 2 composers', async () => {
    const rg = new RuntimeGenerator({
      targetDirectory: '/tmp/runtime',
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
      port: 3043,
    })

    await rg.prepare()

    // double check config files
    const firstComposerConfigFile = firstComposer.getFileObject('platformatic.json')
    const firstComposerConfigFileJson = JSON.parse(firstComposerConfigFile.contents)
    assert.deepEqual(firstComposerConfigFileJson.composer.services, [
      {
        id: 'first-service',
        openapi: {
          url: '/documentation/json',
          prefix: '/first-service',
        },
      },
      {
        id: 'second-service',
        openapi: {
          url: '/documentation/json',
          prefix: '/second-service',
        },
      },
    ])

    const secondComposerConfigFile = secondComposer.getFileObject('platformatic.json')
    const secondComposerConfigFileJson = JSON.parse(secondComposerConfigFile.contents)
    assert.deepEqual(secondComposerConfigFileJson.composer.services, [
      {
        id: 'first-service',
        openapi: {
          url: '/documentation/json',
          prefix: '/first-service',
        },
      },
      {
        id: 'second-service',
        openapi: {
          url: '/documentation/json',
          prefix: '/second-service',
        },
      },
    ])
  })

  test('add services to an existing folder', async (t) => {
    const targetDirectory = await mkdtemp(join(tmpdir(), 'platformatic-runtime-generator-'))
    t.after(async () => {
      await safeRemove(targetDirectory)
    })

    {
      const rg = new RuntimeGenerator({
        targetDirectory,
      })

      // adding one service
      const firstService = new ServiceGenerator()
      rg.addService(firstService, 'first-service')

      // adding another service
      const secondService = new ServiceGenerator()
      rg.addService(secondService, 'second-service')

      rg.setEntryPoint('first-service')

      rg.setConfig({
        port: 3043,
      })

      await rg.prepare()
      await rg.writeFiles()
    }

    {
      const rg = new RuntimeGenerator({
        targetDirectory,
      })

      // adding another service
      const thirdService = new ServiceGenerator()
      rg.addService(thirdService, 'first-service')

      const output = await rg.prepare()

      assert.deepEqual(output, {
        targetDirectory,
        env: {
          PLT_FIRST_SERVICE_TYPESCRIPT: false,
          PLT_SECOND_SERVICE_TYPESCRIPT: 'false',
          PLT_SERVER_HOSTNAME: '127.0.0.1',
          PLT_SERVER_LOGGER_LEVEL: 'info',
          PLT_MANAGEMENT_API: 'true',
          PORT: 3043,
        },
      })

      // should list only runtime files
      const runtimeFileList = rg.listFiles()
      assert.deepEqual(runtimeFileList, ['.env', '.env.sample'])

      // services have correct target directory
      assert.equal(thirdService.targetDirectory, join(rg.targetDirectory, 'services', thirdService.config.serviceName))
    }
  })

  test('should create a runtime with 2 services with typescript enabled', async () => {
    const rg = new RuntimeGenerator({
      targetDirectory: '/tmp/runtime',
      type: 'runtime',
    })

    // adding one service
    const firstService = new ServiceGenerator()
    rg.addService(firstService, 'first-service')

    // adding another service
    const secondService = new ServiceGenerator()
    rg.addService(secondService, 'second-service')

    rg.setEntryPoint('first-service')

    rg.setConfig({
      port: 3043,
      typescript: true,
    })

    await rg.prepare()

    // should list only runtime files
    const runtimeFileList = rg.listFiles()
    assert.deepEqual(runtimeFileList, ['package.json', 'platformatic.json', '.env', '.env.sample', 'tsconfig.json', '.gitignore', 'README.md'])

    // services have correct typescript value in config
    assert.equal(firstService.config.typescript, rg.config.typescript)
    assert.equal(secondService.config.typescript, rg.config.typescript)

    // runtime package.json has typescript dependency
    const packageJson = JSON.parse(rg.getFileObject('package.json').contents)
    assert.ok(packageJson.devDependencies.typescript)
  })

  test('add services to an existing folder (web/)', async (t) => {
    const targetDirectory = await mkdtemp(join(tmpdir(), 'platformatic-runtime-generator-'))
    t.after(async () => {
      await safeRemove(targetDirectory)
    })

    {
      const rg = new RuntimeGenerator({
        targetDirectory,
      })

      rg.setConfig({
        autoload: 'web'
      })

      // adding one service
      const firstService = new ServiceGenerator()
      rg.addService(firstService, 'first-service')

      // adding another service
      const secondService = new ServiceGenerator()
      rg.addService(secondService, 'second-service')

      rg.setEntryPoint('first-service')

      rg.setConfig({
        port: 3043,
      })

      await rg.prepare()
      await rg.writeFiles()
    }

    {
      const rg = new RuntimeGenerator({
        targetDirectory,
      })

      // adding another service
      const thirdService = new ServiceGenerator()
      rg.addService(thirdService, 'first-service')

      const output = await rg.prepare()

      assert.deepEqual(output, {
        targetDirectory,
        env: {
          PLT_FIRST_SERVICE_TYPESCRIPT: false,
          PLT_SECOND_SERVICE_TYPESCRIPT: 'false',
          PLT_SERVER_HOSTNAME: '127.0.0.1',
          PLT_SERVER_LOGGER_LEVEL: 'info',
          PLT_MANAGEMENT_API: 'true',
          PORT: 3043,
        },
      })

      // should list only runtime files
      const runtimeFileList = rg.listFiles()
      assert.deepEqual(runtimeFileList, ['.env', '.env.sample'])

      // services have correct target directory
      assert.equal(thirdService.targetDirectory, join(rg.targetDirectory, 'web', thirdService.config.serviceName))
    }
  })
})
