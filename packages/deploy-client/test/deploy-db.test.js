'use strict'

const { join } = require('path')
const { test } = require('tap')
const { randomUUID } = require('crypto')

const { deploy } = require('../index')
const { startMachine, startDeployService } = require('./helper')
const proxyquire = require('proxyquire')

test('should deploy platformatic project without github metadata', async (t) => {
  t.plan(12)

  const bundleId = 'test-bundle-id'
  const token = 'test-upload-token'

  const workspaceId = 'test-workspace-id'
  const workspaceKey = 'test-workspace-key'

  const entryPointUrl = await startMachine(t, () => {
    t.pass('Action should make a prewarm request to the machine')
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

  await startDeployService(
    t,
    {
      createBundleCallback: (request, reply) => {
        t.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
        t.equal(request.headers['x-platformatic-api-key'], workspaceKey)

        const { bundle } = request.body

        t.equal(bundle.appType, 'db')
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
        t.equal(request.headers.authorization, `Bearer ${token}`)
      }
    }
  )

  const logger = {
    info: () => {},
    trace: () => {},
    warn: () => t.fail('Should not log a warning')
  }

  const result = await deploy({
    deployServiceHost: 'http://localhost:3042',
    workspaceId,
    workspaceKey,
    label,
    pathToProject,
    pathToConfig,
    pathToEnvFile,
    secrets,
    variables,
    compileTypescript: false,
    logger
  })

  t.strictSame(result, {
    deploymentId,
    entryPointUrl
  })
})

test('should successfully deploy platformatic project with PR context', async (t) => {
  t.plan(14)

  const bundleId = 'test-bundle-id'
  const token = 'test-upload-token'

  const workspaceId = 'test-workspace-id'
  const workspaceKey = 'test-workspace-key'

  const entryPointUrl = await startMachine(t, () => {
    t.pass('Action should make a prewarm request to the machine')
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
    },
    pullRequest: {
      number: 1,
      title: 'Test PR title'
    }
  }

  await startDeployService(
    t,
    {
      createBundleCallback: (request, reply) => {
        t.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
        t.equal(request.headers['x-platformatic-api-key'], workspaceKey)

        const { bundle, ...bundleMetadata } = request.body

        t.equal(bundle.appType, 'db')
        t.equal(bundle.configPath, pathToConfig)
        t.ok(bundle.checksum)

        t.same(bundleMetadata, githubMetadata)
        t.ok(request.body.bundle.checksum)
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
        t.equal(request.headers.authorization, `Bearer ${token}`)
      }
    }
  )

  const logger = {
    info: () => {},
    trace: () => {},
    warn: () => t.fail('Should not log a warning')
  }

  const result = await deploy({
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
    githubMetadata,
    logger
  })

  t.strictSame(result, {
    deploymentId,
    entryPointUrl
  })
})

test('should successfully deploy platformatic project with branch context', async (t) => {
  t.plan(13)

  const bundleId = 'test-bundle-id'
  const token = 'test-upload-token'

  const workspaceId = 'test-workspace-id'
  const workspaceKey = 'test-workspace-key'

  const entryPointUrl = await startMachine(t, () => {
    t.pass('Action should make a prewarm request to the machine')
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

  await startDeployService(
    t,
    {
      createBundleCallback: (request, reply) => {
        t.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
        t.equal(request.headers['x-platformatic-api-key'], workspaceKey)

        const { bundle, ...bundleMetadata } = request.body

        t.equal(bundle.appType, 'db')
        t.equal(bundle.configPath, pathToConfig)
        t.ok(bundle.checksum)

        t.same(bundleMetadata, githubMetadata)
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
        t.equal(request.headers.authorization, `Bearer ${token}`)
      }
    }
  )

  const logger = {
    trace: () => {},
    info: () => {},
    warn: () => t.fail('Should not log a warning')
  }

  const result = await deploy({
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
    githubMetadata,
    logger
  })

  t.strictSame(result, {
    deploymentId,
    entryPointUrl
  })
})

test('should successfully deploy platformatic project without github metadata', async (t) => {
  t.plan(12)

  const bundleId = 'test-bundle-id'
  const token = 'test-upload-token'

  const workspaceId = 'test-workspace-id'
  const workspaceKey = 'test-workspace-key'

  const entryPointUrl = await startMachine(t, () => {
    t.pass('Action should make a prewarm request to the machine')
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

  await startDeployService(
    t,
    {
      createBundleCallback: (request, reply) => {
        t.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
        t.equal(request.headers['x-platformatic-api-key'], workspaceKey)
        const { bundle } = request.body

        t.equal(bundle.appType, 'db')
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
        t.equal(request.headers.authorization, `Bearer ${token}`)
      }
    }
  )

  const logger = {
    trace: () => {},
    info: () => {},
    warn: () => t.fail('Should not log a warning')
  }

  const result = await deploy({
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

  t.strictSame(result, {
    deploymentId,
    entryPointUrl
  })
})

test('should successfully deploy platformatic project with branch context', async (t) => {
  t.plan(13)

  const bundleId = 'test-bundle-id'
  const token = 'test-upload-token'

  const workspaceId = 'test-workspace-id'
  const workspaceKey = 'test-workspace-key'

  const entryPointUrl = await startMachine(t, () => {
    t.pass('Action should make a prewarm request to the machine')
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

  await startDeployService(
    t,
    {
      createBundleCallback: (request, reply) => {
        t.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
        t.equal(request.headers['x-platformatic-api-key'], workspaceKey)
        const { bundle, ...bundleMetadata } = request.body

        t.equal(bundle.appType, 'db')
        t.equal(bundle.configPath, pathToConfig)
        t.ok(bundle.checksum)

        t.same(bundleMetadata, githubMetadata)
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
        t.equal(request.headers.authorization, `Bearer ${token}`)
      }
    }
  )

  const logger = {
    trace: () => {},
    info: () => {},
    warn: () => t.fail('Should not log a warning')
  }

  const result = await deploy({
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
    githubMetadata,
    logger
  })

  t.strictSame(result, {
    deploymentId,
    entryPointUrl
  })
})

test('should not deploy bundle of it already exists', async (t) => {
  t.plan(12)

  const bundleId = 'test-bundle-id'
  const token = 'test-upload-token'

  const workspaceId = 'test-workspace-id'
  const workspaceKey = 'test-workspace-key'

  const entryPointUrl = await startMachine(t, () => {
    t.pass('Action should make a prewarm request to the machine')
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

  await startDeployService(
    t,
    {
      createBundleCallback: (request, reply) => {
        t.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
        t.equal(request.headers['x-platformatic-api-key'], workspaceKey)
        const { bundle, ...bundleMetadata } = request.body

        t.equal(bundle.appType, 'db')
        t.equal(bundle.configPath, pathToConfig)
        t.ok(bundle.checksum)

        t.same(bundleMetadata, githubMetadata)
        reply.code(200).send({ id: bundleId, token, isBundleUploaded: true })
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
        t.fail('Should not upload bundle')
      }
    }
  )

  const logger = {
    trace: () => {},
    info: () => {},
    warn: () => t.fail('Should not log a warning')
  }

  const result = await deploy({
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
    githubMetadata,
    logger
  })

  t.strictSame(result, {
    deploymentId,
    entryPointUrl
  })
})

test('should successfully deploy platformatic project without github metadata', async (t) => {
  t.plan(12)

  const bundleId = 'test-bundle-id'
  const token = 'test-upload-token'

  const workspaceId = 'test-workspace-id'
  const workspaceKey = 'test-workspace-key'

  const entryPointUrl = await startMachine(t, () => {
    t.pass('Action should make a prewarm request to the machine')
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

  await startDeployService(
    t,
    {
      createBundleCallback: (request, reply) => {
        t.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
        t.equal(request.headers['x-platformatic-api-key'], workspaceKey)
        const { bundle } = request.body

        t.equal(bundle.appType, 'db')
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
        t.equal(request.headers.authorization, `Bearer ${token}`)
      }
    }
  )

  const logger = {
    trace: () => {},
    info: () => {},
    warn: () => t.fail('Should not log a warning')
  }

  const result = await deploy({
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

  t.strictSame(result, {
    deploymentId,
    entryPointUrl
  })
})

test('should fail if there is no platformatic_workspace_id input param', async (t) => {
  try {
    await deploy({
      compileTypescript: false,
      logger: {
        trace: () => {},
        info: () => {},
        warn: () => t.fail('Should not log a warning')
      }
    })
  } catch (err) {
    t.equal(err.message, 'platformatic_workspace_id action param is required')
  }
})

test('should fail if there is no platformatic_workspace_id input param', async (t) => {
  try {
    await deploy({
      workspaceId: 'test-workspace-id',
      compileTypescript: false,
      logger: {
        trace: () => {},
        info: () => {},
        warn: () => t.fail('Should not log a warning')
      }
    })
  } catch (err) {
    t.equal(err.message, 'platformatic_workspace_key action param is required')
  }
})

test('should fail if platformatic_api_key is wrong', async (t) => {
  await startDeployService(
    t,
    {
      createBundleCallback: (request, reply) => {
        reply.status(401).send({ message: 'Unauthorized' })
      }
    }
  )

  try {
    await deploy({
      deployServiceHost: 'http://localhost:3042',
      workspaceId: 'test-workspace-id',
      workspaceKey: 'test-workspace-key',
      pathToProject: join(__dirname, 'fixtures', 'db-basic'),
      compileTypescript: false,
      logger: {
        trace: () => {},
        info: () => {},
        warn: () => t.fail('Should not log a warning')
      }
    })
  } catch (err) {
    t.equal(err.message, 'Invalid platformatic_workspace_key provided')
  }
})

test('should fail if it could not create a bundle', async (t) => {
  await startDeployService(
    t,
    {
      createBundleCallback: (request, reply) => {
        reply.status(500).send({ message: 'Error' })
      }
    }
  )

  try {
    await deploy({
      deployServiceHost: 'http://localhost:3042',
      workspaceId: 'test-workspace-id',
      workspaceKey: 'test-workspace-key',
      pathToProject: join(__dirname, 'fixtures', 'db-basic'),
      compileTypescript: false,
      logger: {
        trace: () => {},
        info: () => {},
        warn: () => t.fail('Should not log a warning')
      }
    })
  } catch (err) {
    t.equal(err.message, 'Could not create a bundle: 500')
  }
})

test('should fail if platformatic_api_key is wrong', async (t) => {
  await startDeployService(
    t,
    {
      createDeploymentCallback: (request, reply) => {
        reply.status(401).send({ message: 'Unauthorized' })
      },
      uploadCallback: () => {
        t.pass('should upload code')
      }
    }
  )

  try {
    await deploy({
      deployServiceHost: 'http://localhost:3042',
      workspaceId: 'test-workspace-id',
      workspaceKey: 'test-workspace-key',
      pathToProject: join(__dirname, 'fixtures', 'db-basic'),
      compileTypescript: false,
      logger: {
        trace: () => {},
        info: () => {},
        warn: () => t.fail('Should not log a warning')
      }
    })
  } catch (err) {
    t.equal(err.message, 'Invalid platformatic_workspace_key provided')
  }
})

test('should fail if it could not create a deployment', async (t) => {
  await startDeployService(
    t,
    {
      createDeploymentCallback: (request, reply) => {
        reply.status(500).send({ message: 'Error' })
      }
    }
  )

  try {
    await deploy({
      deployServiceHost: 'http://localhost:3042',
      workspaceId: 'test-workspace-id',
      compileTypescript: false,
      workspaceKey: 'test-workspace-key',
      pathToProject: join(__dirname, 'fixtures', 'db-basic'),
      logger: {
        trace: () => {},
        info: () => {},
        warn: () => t.fail('Should not log a warning')
      }
    })
  } catch (err) {
    t.equal(err.message, 'Could not create a deployment: 500')
  }
})

test('should fail if it could not upload code tarball', async (t) => {
  await startDeployService(t, {
    uploadCallback: (request, reply) => {
      reply.status(500).send({ message: 'Error' })
    }
  })

  try {
    await deploy({
      deployServiceHost: 'http://localhost:3042',
      workspaceId: 'test-workspace-id',
      workspaceKey: 'test-workspace-key',
      compileTypescript: false,
      pathToProject: join(__dirname, 'fixtures', 'db-basic'),
      logger: {
        trace: () => {},
        info: () => {},
        warn: () => t.fail('Should not log a warning')
      }
    })
  } catch (err) {
    t.equal(err.message, 'Failed to upload code archive: 500')
  }
})

test('should fail if it could not make a prewarm call', async (t) => {
  t.plan(5)

  const bundleId = 'test-bundle-id'
  const token = 'test-upload-token'

  const entryPointUrl = await startMachine(t, (request, reply) => {
    reply.status(500).send({ message: 'Error' })
  })

  const deploymentId = randomUUID()

  await startDeployService(t, {
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
    await deploy({
      deployServiceHost: 'http://localhost:3042',
      workspaceId: 'test-workspace-id',
      workspaceKey: 'test-workspace-key',
      pathToProject: join(__dirname, 'fixtures', 'db-basic'),
      compileTypescript: false,
      logger: {
        trace: () => {},
        info: () => {},
        warn: (message) => {
          t.equal(message, 'Could not make a prewarm call: Request failed with status code: 500 {"message":"Error"}, retrying...')
        }
      }
    })
  } catch (err) {
    t.equal(err.message, 'Could not make a prewarm call: Request failed with status code: 500 {"message":"Error"}')
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
        warn: () => t.fail('Should not log a warning')
      }
    })
  } catch (err) {
    t.match(err.message, /Missing config file!/)
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
        warn: () => t.fail('Should not log a warning')
      }
    })
  } catch (err) {
    t.equal(err.message, 'Could not find Platformatic config file')
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
        warn: () => t.fail('Should not log a warning')
      }
    })
  } catch (err) {
    t.match(err.message, /Missing config file!/)
  }
})

test('should deploy platformatic project without typescript dep', async (t) => {
  t.plan(12)

  const bundleId = 'test-bundle-id'
  const token = 'test-upload-token'

  const workspaceId = 'test-workspace-id'
  const workspaceKey = 'test-workspace-key'

  const entryPointUrl = await startMachine(t, () => {
    t.pass('Action should make a prewarm request to the machine')
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

  await startDeployService(
    t,
    {
      createBundleCallback: (request, reply) => {
        t.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
        t.equal(request.headers['x-platformatic-api-key'], workspaceKey)

        const { bundle } = request.body

        t.equal(bundle.appType, 'db')
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
        t.equal(request.headers.authorization, `Bearer ${token}`)
      }
    }
  )

  const logger = {
    info: () => {},
    trace: () => {},
    warn: () => t.fail('Should not log a warning')
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

  const result = await deploy({
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

  t.strictSame(result, {
    deploymentId,
    entryPointUrl
  })
})
