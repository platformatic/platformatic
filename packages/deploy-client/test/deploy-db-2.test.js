'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')
const { randomUUID } = require('node:crypto')

const { deploy } = require('../index')
const { startMachine, startDeployService } = require('./helper')

test('should successfully deploy platformatic project without github metadata', async (t) => {
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
    trace: () => {},
    info: () => {},
    warn: () => assert.fail('Should not log a warning')
  }

  const deployServicePort = deployService.server.address().port
  const deployServiceHost = `http://127.0.0.1:${deployServicePort}`

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

test('should successfully deploy platformatic project with branch context', async (t) => {
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

  const githubMetadata = {
    repository: {
      name: 'test-repo-name',
      url: 'https://github.com/test-github-user/test-repo-name',
      githubRepoId: 1234
    },
    branch: {
      name: 'test'
    },
    commit: {
      sha: '1234',
      username: 'test-github-user',
      additions: 1,
      deletions: 1
    }
  }

  const deployService = await startDeployService(
    t,
    {
      createBundleCallback: (request, reply) => {
        assert.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
        assert.equal(request.headers['x-platformatic-api-key'], workspaceKey)
        const { bundle, ...bundleMetadata } = request.body

        assert.equal(bundle.appType, 'db')
        assert.equal(bundle.configPath, pathToConfig)
        assert.ok(bundle.checksum)

        assert.deepEqual(bundleMetadata, githubMetadata)
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
    trace: () => {},
    info: () => {},
    warn: () => assert.fail('Should not log a warning')
  }

  const deployServicePort = deployService.server.address().port
  const deployServiceHost = `http://127.0.0.1:${deployServicePort}`

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
    githubMetadata,
    logger
  })

  assert.equal(isMachinePreWarmed, true)
  assert.deepEqual(result, {
    deploymentId,
    entryPointUrl
  })
})

test('should not deploy bundle of it already exists', async (t) => {
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

  const githubMetadata = {
    repository: {
      name: 'test-repo-name',
      url: 'https://github.com/test-github-user/test-repo-name',
      githubRepoId: 1234
    },
    branch: {
      name: 'test'
    },
    commit: {
      sha: '1234',
      username: 'test-github-user',
      additions: 1,
      deletions: 1
    }
  }

  const deployService = await startDeployService(
    t,
    {
      createBundleCallback: (request, reply) => {
        assert.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
        assert.equal(request.headers['x-platformatic-api-key'], workspaceKey)
        const { bundle, ...bundleMetadata } = request.body

        assert.equal(bundle.appType, 'db')
        assert.equal(bundle.configPath, pathToConfig)
        assert.ok(bundle.checksum)

        assert.deepEqual(bundleMetadata, githubMetadata)
        reply.code(200).send({ id: bundleId, token, isBundleUploaded: true })
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
        assert.fail('Should not upload bundle')
      }
    }
  )

  const logger = {
    trace: () => {},
    info: () => {},
    warn: () => assert.fail('Should not log a warning')
  }

  const deployServicePort = deployService.server.address().port
  const deployServiceHost = `http://127.0.0.1:${deployServicePort}`

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
    githubMetadata,
    logger
  })

  assert.equal(isMachinePreWarmed, true)
  assert.deepEqual(result, {
    deploymentId,
    entryPointUrl
  })
})
