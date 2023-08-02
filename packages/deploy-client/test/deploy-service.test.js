'use strict'

const { join } = require('path')
const { test } = require('tap')

const { deploy } = require('../index')
const { startMachine, startDeployService } = require('./helper')
const { rm, access } = require('fs/promises')

test('should deploy platformatic service by compiling typescript', async (t) => {
  try {
    await rm(join(__dirname, 'fixtures', 'service-ts', 'dist'), { recursive: true, force: true })
  } catch {}
  t.teardown(async () => {
    try {
      await rm(join(__dirname, 'fixtures', 'service-ts', 'dist'), { recursive: true, force: true })
    } catch {}
  })

  const bundleId = 'test-bundle-id'
  const token = 'test-upload-token'

  const workspaceId = 'test-workspace-id'
  const workspaceKey = 'test-workspace-key'

  const entryPointUrl = await startMachine(t, () => {
    t.pass('Action should make a prewarm request to the machine')
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

  await startDeployService(
    t,
    {
      createBundleCallback: (request, reply) => {
        t.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
        t.equal(request.headers['x-platformatic-api-key'], workspaceKey)

        const { bundle } = request.body

        t.equal(bundle.appType, 'service')
        t.equal(bundle.configPath, pathToConfig)
        t.ok(bundle.checksum)

        reply.code(200).send({ id: bundleId, token, isBundleUploaded: false })
      },
      createDeploymentCallback: (request, reply) => {
        t.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
        t.equal(request.headers['x-platformatic-api-key'], workspaceKey)
        t.equal(request.headers.authorization, `Bearer ${token}`)
        t.same(
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
        reply.code(200).send({ entryPointUrl })
      },
      uploadCallback: (request) => {
        t.equal(request.headers.authorization, `Bearer ${token}`)
      }
    }
  )

  const logger = {
    info: () => {},
    trace: () => {},
    warn: () => t.fail('Should not log a warning')
  }

  await deploy({
    deployServiceHost: 'http://localhost:3042',
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

  await access(join(__dirname, 'fixtures', 'service-ts', 'dist', 'plugin.js'))
})
