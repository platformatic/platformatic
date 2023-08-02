'use strict'

const { join } = require('path')
const { test } = require('tap')

const { deploy } = require('../index')
const { startMachine, startDeployService } = require('./helper')

test('should deploy platformatic runtime project without github metadata', async (t) => {
  t.plan(12)

  const bundleId = 'test-bundle-id'
  const token = 'test-upload-token'

  const workspaceId = 'test-workspace-id'
  const workspaceKey = 'test-workspace-key'

  const entryPointUrl = await startMachine(t, () => {
    t.pass('Action should make a prewarm request to the machine')
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

  await startDeployService(
    t,
    {
      createBundleCallback: (request, reply) => {
        t.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
        t.equal(request.headers['x-platformatic-api-key'], workspaceKey)

        const { bundle } = request.body

        t.equal(bundle.appType, 'runtime')
        t.equal(bundle.configPath, pathToConfig)
        t.ok(bundle.checksum)

        t.ok(request.body.bundle.checksum)

        reply.code(200).send({ id: bundleId, token, isBundleUploaded: false })
      },
      createDeploymentCallback: (request, reply) => {
        t.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
        t.equal(request.headers['x-platformatic-api-key'], workspaceKey)
        t.equal(request.headers.authorization, `Bearer ${token}`)
        t.same(
          request.body,
          { label, metadata, variables, secrets }
        )
        reply.code(200).send({ entryPointUrl })
      },
      uploadCallback: (request) => {
        t.equal(request.headers.authorization, `Bearer ${token}`)
      }
    }
  )

  const logger = {
    trace: () => {},
    info: () => {},
    warn: () => t.fail('Should not log a warning')
  }

  await deploy({
    deployServiceHost: 'http://localhost:3042',
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
})
