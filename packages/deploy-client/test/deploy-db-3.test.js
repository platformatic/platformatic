'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')
const { randomUUID } = require('node:crypto')

const proxyquire = require('proxyquire')
const { deploy } = require('../index')
const { startMachine, startDeployService } = require('./helper')

test('should fail if there is no platformatic_workspace_id input param', async (t) => {
  try {
    await deploy({
      compileTypescript: false,
      logger: {
        trace: () => {},
        info: () => {},
        warn: () => assert.fail('Should not log a warning')
      }
    })
  } catch (err) {
    assert.equal(err.message, 'platformatic_workspace_id action param is required')
  }
})

test('should fail if there is no platformatic workspace key input param', async (t) => {
  try {
    await deploy({
      workspaceId: 'test-workspace-id',
      compileTypescript: false,
      logger: {
        trace: () => {},
        info: () => {},
        warn: () => assert.fail('Should not log a warning')
      }
    })
  } catch (err) {
    assert.equal(err.message, 'platformatic workspace key or user api key is required')
  }
})

test('should fail if platformatic_api_key is wrong 1s', async (t) => {
  const deployService = await startDeployService(
    t,
    {
      createBundleCallback: (request, reply) => {
        reply.status(401).send({ message: 'Unauthorized' })
      }
    }
  )

  try {
    const deployServicePort = deployService.server.address().port
    const deployServiceHost = `http://localhost:${deployServicePort}`

    await deploy({
      deployServiceHost,
      workspaceId: 'test-workspace-id',
      workspaceKey: 'test-workspace-key',
      pathToProject: join(__dirname, 'fixtures', 'db-basic'),
      compileTypescript: false,
      logger: {
        trace: () => {},
        info: () => {},
        warn: () => assert.fail('Should not log a warning')
      }
    })
  } catch (err) {
    assert.equal(err.message, 'Invalid platformatic_workspace_key provided')
  }
})

test('should fail if it could not create a bundle', async (t) => {
  const deployService = await startDeployService(
    t,
    {
      createBundleCallback: (request, reply) => {
        reply.status(500).send({ message: 'Error' })
      }
    }
  )

  try {
    const deployServicePort = deployService.server.address().port
    const deployServiceHost = `http://localhost:${deployServicePort}`

    await deploy({
      deployServiceHost,
      workspaceId: 'test-workspace-id',
      workspaceKey: 'test-workspace-key',
      pathToProject: join(__dirname, 'fixtures', 'db-basic'),
      compileTypescript: false,
      logger: {
        trace: () => {},
        info: () => {},
        warn: () => assert.fail('Should not log a warning')
      }
    })
  } catch (err) {
    assert.equal(err.message, 'Could not create a bundle: 500')
  }
})

test('should fail if platformatic_api_key is wrong 2', async (t) => {
  const deployService = await startDeployService(
    t,
    {
      createDeploymentCallback: (request, reply) => {
        reply.status(401).send({ message: 'Unauthorized' })
      },
      uploadCallback: () => {}
    }
  )

  try {
    const deployServicePort = deployService.server.address().port
    const deployServiceHost = `http://localhost:${deployServicePort}`

    await deploy({
      deployServiceHost,
      workspaceId: 'test-workspace-id',
      workspaceKey: 'test-workspace-key',
      pathToProject: join(__dirname, 'fixtures', 'db-basic'),
      compileTypescript: false,
      logger: {
        trace: () => {},
        info: () => {},
        warn: () => assert.fail('Should not log a warning')
      }
    })
  } catch (err) {
    assert.equal(err.message, 'Invalid platformatic_workspace_key provided')
  }
})

test('should fail if it could not create a deployment', async (t) => {
  const deployService = await startDeployService(
    t,
    {
      createDeploymentCallback: (request, reply) => {
        reply.status(500).send({ message: 'Error' })
      }
    }
  )

  try {
    const deployServicePort = deployService.server.address().port
    const deployServiceHost = `http://localhost:${deployServicePort}`

    await deploy({
      deployServiceHost,
      workspaceId: 'test-workspace-id',
      compileTypescript: false,
      workspaceKey: 'test-workspace-key',
      pathToProject: join(__dirname, 'fixtures', 'db-basic'),
      logger: {
        trace: () => {},
        info: () => {},
        warn: () => assert.fail('Should not log a warning')
      }
    })
  } catch (err) {
    assert.equal(err.message, 'Could not create a deployment: 500')
  }
})

test('should fail if it could not upload code tarball', async (t) => {
  const deployService = await startDeployService(t, {
    uploadCallback: (request, reply) => {
      reply.status(500).send({ message: 'Error' })
    }
  })

  try {
    const deployServicePort = deployService.server.address().port
    const deployServiceHost = `http://localhost:${deployServicePort}`

    await deploy({
      deployServiceHost,
      workspaceId: 'test-workspace-id',
      workspaceKey: 'test-workspace-key',
      compileTypescript: false,
      pathToProject: join(__dirname, 'fixtures', 'db-basic'),
      logger: {
        trace: () => {},
        info: () => {},
        warn: () => assert.fail('Should not log a warning')
      }
    })
  } catch (err) {
    assert.equal(err.message, 'Failed to upload code archive: 500')
  }
})

test('should fail if it could not make a prewarm call', async (t) => {
  const bundleId = 'test-bundle-id'
  const token = 'test-upload-token'

  const entryPointUrl = await startMachine(t, (request, reply) => {
    reply.status(500).send({ message: 'Error' })
  })

  const deploymentId = randomUUID()

  const deployService = await startDeployService(t, {
    createBundleCallback: (request, reply) => {
      reply.code(200).send({ id: bundleId, token, isBundleUploaded: false })
    },
    createDeploymentCallback: (request, reply) => {
      reply.code(200).send({
        id: deploymentId,
        entryPointUrl
      })
    }
  })

  try {
    const deployServicePort = deployService.server.address().port
    const deployServiceHost = `http://localhost:${deployServicePort}`

    await deploy({
      deployServiceHost,
      workspaceId: 'test-workspace-id',
      workspaceKey: 'test-workspace-key',
      pathToProject: join(__dirname, 'fixtures', 'db-basic'),
      compileTypescript: false,
      logger: {
        trace: () => {},
        info: () => {},
        warn: (message) => {
          assert.equal(message, 'Could not make a prewarm call: Request failed with status code: 500 {"message":"Error"}, retrying...')
        }
      }
    })
  } catch (err) {
    assert.equal(err.message, 'Could not make a prewarm call: Request failed with status code: 500 {"message":"Error"}')
  }
})

test('should fail if there is no config file', async (t) => {
  try {
    await deploy({
      deployServiceHost: 'http://localhost:3042',
      workspaceId: 'test-workspace-id',
      workspaceKey: 'test-workspace-key',
      pathToProject: join(__dirname, 'fixtures', 'db-basic'),
      pathToConfig: './platformatic1.db.json',
      compileTypescript: false,
      logger: {
        trace: () => {},
        info: () => {},
        warn: () => assert.fail('Should not log a warning')
      }
    })
  } catch (err) {
    assert.match(err.message, /Missing config file!/)
  }
})

test('should fail if there is no config file', async (t) => {
  try {
    await deploy({
      deployServiceHost: 'http://localhost:3042',
      workspaceId: 'test-workspace-id',
      workspaceKey: 'test-workspace-key',
      pathToProject: join(__dirname, 'fixtures', 'db-wrong-config-ext'),
      compileTypescript: false,
      logger: {
        trace: () => {},
        info: () => {},
        warn: () => assert.fail('Should not log a warning')
      }
    })
  } catch (err) {
    assert.equal(err.message, 'Could not find Platformatic config file')
  }
})

test('should fail if there is no config file', async (t) => {
  try {
    await deploy({
      deployServiceHost: 'http://localhost:3042',
      workspaceId: 'test-workspace-id',
      workspaceKey: 'test-workspace-key',
      pathToProject: join(__dirname, 'fixtures', 'db-wrong-config-ext'),
      pathToConfig: './platformatic.wrong.json',
      compileTypescript: false,
      logger: {
        trace: () => {},
        info: () => {},
        warn: () => assert.fail('Should not log a warning')
      }
    })
  } catch (err) {
    assert.match(err.message, /Missing config file!/)
  }
})

test('should deploy platformatic project without typescript dep', async (t) => {
  const bundleId = 'test-bundle-id'
  const token = 'test-upload-token'

  const workspaceId = 'test-workspace-id'
  const workspaceKey = 'test-workspace-key'

  let isMachinePreWarmed = false
  const entryPointUrl = await startMachine(t, () => {
    isMachinePreWarmed = true
  })

  const pathToProject = join(__dirname, 'fixtures', 'db-basic')
  const pathToConfig = './platformatic.db.json'
  const pathToEnvFile = './.env'

  const label = 'github-pr:1'

  const variables = {
    ENV_VARIABLE_1: 'value1',
    ENV_VARIABLE_2: 'value2'
  }

  const secrets = {
    SECRET_VARIABLE_1: 'value3'
  }

  const deploymentId = randomUUID()

  const deployService = await startDeployService(
    t,
    {
      createBundleCallback: (request, reply) => {
        assert.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
        assert.equal(request.headers['x-platformatic-api-key'], workspaceKey)

        const { bundle } = request.body

        assert.equal(bundle.appType, 'db')
        assert.equal(bundle.configPath, pathToConfig)
        assert.ok(bundle.checksum)

        reply.code(200).send({ id: bundleId, token, isBundleUploaded: false })
      },
      createDeploymentCallback: (request, reply) => {
        assert.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
        assert.equal(request.headers['x-platformatic-api-key'], workspaceKey)
        assert.equal(request.headers.authorization, `Bearer ${token}`)
        assert.deepEqual(
          request.body,
          {
            label,
            metadata: {
              appType: 'db'
            },
            variables: {
              ...variables,
              FILE_ENV_VARIABLE1: 'platformatic_variable1',
              FILE_ENV_VARIABLE2: 'platformatic_variable2'
            },
            secrets: {
              ...secrets,
              FILE_SECRET_VARIABLE1: 'platformatic_secret1',
              FILE_SECRET_VARIABLE2: 'platformatic_secret2'
            }
          }
        )
        reply.code(200).send({
          id: deploymentId,
          entryPointUrl
        })
      },
      uploadCallback: (request) => {
        assert.equal(request.headers.authorization, `Bearer ${token}`)
      }
    }
  )

  const logger = {
    info: () => {},
    trace: () => {},
    warn: () => assert.fail('Should not log a warning')
  }

  const runtime = require('@platformatic/runtime')

  const { deploy } = proxyquire('../index.js', {
    '@platformatic/runtime': {
      ...runtime,
      async compile () {
        // Simulate missing typescript
        const err = new Error('Module not found')
        err.code = 'MODULE_NOT_FOUND'
        throw err
      }
    }
  })

  const deployServicePort = deployService.server.address().port
  const deployServiceHost = `http://localhost:${deployServicePort}`

  const result = await deploy({
    deployServiceHost,
    workspaceId,
    workspaceKey,
    label,
    pathToProject,
    pathToConfig,
    pathToEnvFile,
    secrets,
    variables,
    logger
  })

  assert.equal(isMachinePreWarmed, true)
  assert.deepEqual(result, {
    deploymentId,
    entryPointUrl
  })
})
