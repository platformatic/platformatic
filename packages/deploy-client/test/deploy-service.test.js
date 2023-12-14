'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')
const { randomUUID } = require('node:crypto')
const { rm, access } = require('node:fs/promises')

const { deploy } = require('../index')
const { startMachine, startDeployService } = require('./helper')

test('should deploy platformatic service by compiling typescript', async (t) => {
  try {
    await rm(join(__dirname, 'fixtures', 'service-ts', 'dist'), { recursive: true, force: true })
  } catch {}
  t.after(async () => {
    try {
      await rm(join(__dirname, 'fixtures', 'service-ts', 'dist'), { recursive: true, force: true })
    } catch {}
  })

  const bundleId = 'test-bundle-id'
  const token = 'test-upload-token'

  const workspaceId = 'test-workspace-id'
  const workspaceKey = 'test-workspace-key'

  let isMachinePreWarmed = false
  const entryPointUrl = await startMachine(t, () => {
    isMachinePreWarmed = true
  })

  const pathToProject = join(__dirname, 'fixtures', 'service-ts')
  const pathToConfig = './platformatic.service.json'
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

        assert.equal(bundle.appType, 'service')
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
              appType: 'service'
            },
            variables: {
              ...variables,
              FILE_ENV_VARIABLE1: 'platformatic_variable1',
              FILE_ENV_VARIABLE2: 'platformatic_variable2',
              PLT_TYPESCRIPT: 'false'
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

  const deployServicePort = deployService.server.address().port
  const deployServiceHost = `http://127.0.0.1:${deployServicePort}`

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

  await access(join(__dirname, 'fixtures', 'service-ts', 'dist', 'plugin.js'))
})
