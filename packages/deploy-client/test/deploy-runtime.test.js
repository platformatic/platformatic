'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')
const { randomUUID } = require('node:crypto')

const { deploy } = require('../index')
const { startMachine, startDeployService } = require('./helper')

test('should deploy platformatic runtime project without github metadata', async (t) => {
  const bundleId = 'test-bundle-id'
  const token = 'test-upload-token'

  const workspaceId = 'test-workspace-id'
  const workspaceKey = 'test-workspace-key'

  let isMachinePreWarmed = false
  const entryPointUrl = await startMachine(t, () => {
    isMachinePreWarmed = true
  })

  const pathToProject = join(__dirname, 'fixtures', 'runtime-basic')
  const pathToConfig = './platformatic.runtime.json'
  const pathToEnvFile = './.env'

  const label = 'github-pr:1'

  const variables = {
    ENV_VARIABLE_1: 'value1',
    ENV_VARIABLE_2: 'value2'
  }

  const secrets = {
    SECRET_VARIABLE_1: 'value3'
  }

  const metadata = {
    appType: 'runtime',
    services: [
      {
        id: 'serviceApp',
        entrypoint: true
      },
      {
        id: 'with-logger',
        entrypoint: false
      }
    ]
  }

  const deploymentId = randomUUID()

  const deployService = await startDeployService(
    t,
    {
      createBundleCallback: (request, reply) => {
        assert.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
        assert.equal(request.headers['x-platformatic-api-key'], workspaceKey)

        const { bundle } = request.body

        assert.equal(bundle.appType, 'runtime')
        assert.equal(bundle.configPath, pathToConfig)
        assert.ok(bundle.checksum)

        assert.ok(request.body.bundle.checksum)

        reply.code(200).send({ id: bundleId, token, isBundleUploaded: false })
      },
      createDeploymentCallback: (request, reply) => {
        assert.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
        assert.equal(request.headers['x-platformatic-api-key'], workspaceKey)
        assert.equal(request.headers.authorization, `Bearer ${token}`)
        assert.deepEqual(
          request.body,
          { label, metadata, variables, secrets }
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
    trace: () => {},
    info: () => {},
    warn: () => assert.fail('Should not log a warning')
  }

  const deployServicePort = deployService.server.address().port
  const deployServiceHost = `http://localhost:${deployServicePort}`

  const result = await deploy({
    deployServiceHost,
    compileTypescript: false,
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
