import { test } from 'tap'
import { join } from 'desm'
import { execa } from 'execa'

import { cliPath, startDeployService, startMachine } from './helper.js'

test('should deploy to a static workspace to the cloud', async (t) => {
  const workspaceType = 'static'
  const workspaceId = 'b3d7f7e0-8c03-11e8-9eb6-529269fb1459'
  const workspaceKey = 'b3d7f7e08c0311e89eb6529269fb1459'
  const pathToConfig = join(import.meta.url, './fixtures/app-to-deploy/platformatic.db.json')

  const machineHost = await startMachine(t)
  const deployServiceHost = await startDeployService(t, {
    createBundleCallback: (request, reply) => {
      t.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
      t.equal(request.headers['x-platformatic-api-key'], workspaceKey)
      t.match(request.body, {
        bundle: {
          appType: 'db',
          configPath: 'platformatic.db.json'
        }
      })
      t.ok(request.body.bundle.checksum)
    },
    createDeploymentCallback: (request, reply) => {
      t.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
      t.equal(request.headers['x-platformatic-api-key'], workspaceKey)
      t.same(
        request.body,
        {
          metadata: {
            appType: 'db'
          },
          variables: {
            PLT_ENV_VARIABLE1: 'platformatic_variable1',
            PLT_ENV_VARIABLE2: 'platformatic_variable2'
          },
          secrets: {
            PLT_SECRET_1: 'platformatic_secret_1',
            PLT_SECRET_2: 'platformatic_secret_2'
          }
        }
      )
      reply.code(200).send({ entryPointUrl: machineHost })
    }
  })

  await execa('node', [
    cliPath, 'deploy',
    '--type', workspaceType,
    '--config', pathToConfig,
    '--workspace-id', workspaceId,
    '--workspace-key', workspaceKey,
    '--deploy-service-host', deployServiceHost
  ])
})

test('should deploy to a dynamic workspace to the cloud', async (t) => {
  const workspaceType = 'dynamic'
  const workspaceId = 'b3d7f7e0-8c03-11e8-9eb6-529269fb1459'
  const workspaceKey = 'b3d7f7e08c0311e89eb6529269fb1459'
  const pathToConfig = join(import.meta.url, './fixtures/app-to-deploy/platformatic.db.json')
  const label = 'cli:deploy-2'

  const machineHost = await startMachine(t)
  const deployServiceHost = await startDeployService(t, {
    createBundleCallback: (request, reply) => {
      t.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
      t.equal(request.headers['x-platformatic-api-key'], workspaceKey)
      t.match(request.body, {
        bundle: {
          appType: 'db',
          configPath: 'platformatic.db.json'
        }
      })
      t.ok(request.body.bundle.checksum)
    },
    createDeploymentCallback: (request, reply) => {
      t.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
      t.equal(request.headers['x-platformatic-api-key'], workspaceKey)
      t.same(
        request.body,
        {
          label,
          metadata: {
            appType: 'db'
          },
          variables: {
            PLT_ENV_VARIABLE1: 'platformatic_variable1',
            PLT_ENV_VARIABLE2: 'platformatic_variable2'
          },
          secrets: {
            PLT_SECRET_1: 'platformatic_secret_1',
            PLT_SECRET_2: 'platformatic_secret_2'
          }
        }
      )
      reply.code(200).send({ entryPointUrl: machineHost })
    }
  })

  await execa('node', [
    cliPath, 'deploy',
    '--type', workspaceType,
    '--label', label,
    '--config', pathToConfig,
    '--workspace-id', workspaceId,
    '--workspace-key', workspaceKey,
    '--deploy-service-host', deployServiceHost
  ])
})

test('should fail if workspace id is not a uuid', async (t) => {
  const workspaceType = 'static'
  const workspaceId = 'not-a-uuid'
  const workspaceKey = 'b3d7f7e08c0311e89eb6529269fb1459'
  const pathToConfig = join(import.meta.url, './fixtures/app-to-deploy/platformatic.db.json')

  try {
    await execa('node', [
      cliPath, 'deploy',
      '--type', workspaceType,
      '--config', pathToConfig,
      '--workspace-id', workspaceId,
      '--workspace-key', workspaceKey,
      '--deploy-service-host', 'http://localhost:5555'
    ])
    t.fail('should have failed')
  } catch (err) {
    t.ok(err.message.includes('Invalid workspace id provided. Workspace id must be a valid uuid.'))
  }
})

test('should fail if invalid workspace type provided', async (t) => {
  const workspaceType = 'wrong'
  const workspaceId = 'b3d7f7e0-8c03-11e8-9eb6-529269fb1459'
  const workspaceKey = 'b3d7f7e08c0311e89eb6529269fb1459'
  const pathToConfig = join(import.meta.url, './fixtures/app-to-deploy/platformatic.db.json')

  try {
    await execa('node', [
      cliPath, 'deploy',
      '--type', workspaceType,
      '--config', pathToConfig,
      '--workspace-id', workspaceId,
      '--workspace-key', workspaceKey,
      '--deploy-service-host', 'http://localhost:5555'
    ])
    t.fail('should have failed')
  } catch (err) {
    t.ok(err.message.includes('Invalid workspace type provided'))
  }
})

test('should deploy to a dynamic workspace to the cloud', async (t) => {
  const workspaceType = 'dynamic'
  const workspaceId = 'b3d7f7e0-8c03-11e8-9eb6-529269fb1459'
  const workspaceKey = 'b3d7f7e08c0311e89eb6529269fb1459'
  const pathToConfig = join(import.meta.url, './fixtures/app-to-deploy/platformatic.db.json')
  const label = 'cli:deploy-2'

  const machineHost = await startMachine(t)
  const deployServiceHost = await startDeployService(t, {
    createBundleCallback: (request, reply) => {
      t.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
      t.equal(request.headers['x-platformatic-api-key'], workspaceKey)
      t.match(request.body, {
        bundle: {
          appType: 'db',
          configPath: 'platformatic.db.json'
        }
      })
      t.ok(request.body.bundle.checksum)
    },
    createDeploymentCallback: (request, reply) => {
      t.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
      t.equal(request.headers['x-platformatic-api-key'], workspaceKey)
      t.same(
        request.body,
        {
          label,
          metadata: {
            appType: 'db'
          },
          variables: {
            PLT_ENV_VARIABLE1: 'platformatic_variable1',
            PLT_ENV_VARIABLE2: 'platformatic_variable2'
          },
          secrets: {
            PLT_SECRET_1: 'platformatic_secret_1',
            PLT_SECRET_2: 'platformatic_secret_2'
          }
        }
      )
      reply.code(200).send({ entryPointUrl: machineHost })
    }
  })

  await execa('node', [
    cliPath, 'deploy',
    '--type', workspaceType,
    '--label', 'deploy-2',
    '--config', pathToConfig,
    '--workspace-id', workspaceId,
    '--workspace-key', workspaceKey,
    '--deploy-service-host', deployServiceHost
  ])
})

test('should deploy to a static workspace with a keys option', async (t) => {
  const workspaceId = 'b3d7f7e0-8c03-11e8-9eb6-529269fb1459'
  const workspaceKey = 'b3d7f7e08c0311e89eb6529269fb1459'

  const pathToConfig = join(import.meta.url, './fixtures/app-to-deploy/platformatic.db.json')
  const pathToKeys = join(import.meta.url, './fixtures/app-to-deploy/static.txt')

  const machineHost = await startMachine(t)
  const deployServiceHost = await startDeployService(t, {
    createBundleCallback: (request, reply) => {
      t.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
      t.equal(request.headers['x-platformatic-api-key'], workspaceKey)
      t.match(request.body, {
        bundle: {
          appType: 'db',
          configPath: 'platformatic.db.json'
        }
      })
      t.ok(request.body.bundle.checksum)
    },
    createDeploymentCallback: (request, reply) => {
      t.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
      t.equal(request.headers['x-platformatic-api-key'], workspaceKey)
      t.same(
        request.body,
        {
          metadata: {
            appType: 'db'
          },
          variables: {
            PLT_ENV_VARIABLE1: 'platformatic_variable1',
            PLT_ENV_VARIABLE2: 'platformatic_variable2'
          },
          secrets: {
            PLT_SECRET_1: 'platformatic_secret_1',
            PLT_SECRET_2: 'platformatic_secret_2'
          }
        }
      )
      reply.code(200).send({ entryPointUrl: machineHost })
    }
  })

  await execa('node', [
    cliPath, 'deploy',
    '--keys', pathToKeys,
    '--config', pathToConfig,
    '--deploy-service-host', deployServiceHost
  ])
})

test('should deploy to a static workspace with a keys option', async (t) => {
  const workspaceId = 'b3d7f7e0-8c03-11e8-9eb6-529269fb1459'
  const workspaceKey = 'b3d7f7e08c0311e89eb6529269fb1459'

  const pathToConfig = join(import.meta.url, './fixtures/app-to-deploy/platformatic.db.json')
  const pathToKeys = './static.txt'

  const machineHost = await startMachine(t)
  const deployServiceHost = await startDeployService(t, {
    createBundleCallback: (request, reply) => {
      t.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
      t.equal(request.headers['x-platformatic-api-key'], workspaceKey)
      t.match(request.body, {
        bundle: {
          appType: 'db',
          configPath: 'platformatic.db.json'
        }
      })
      t.ok(request.body.bundle.checksum)
    },
    createDeploymentCallback: (request, reply) => {
      t.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
      t.equal(request.headers['x-platformatic-api-key'], workspaceKey)
      t.same(
        request.body,
        {
          metadata: {
            appType: 'db'
          },
          variables: {
            PLT_ENV_VARIABLE1: 'platformatic_variable1',
            PLT_ENV_VARIABLE2: 'platformatic_variable2'
          },
          secrets: {
            PLT_SECRET_1: 'platformatic_secret_1',
            PLT_SECRET_2: 'platformatic_secret_2'
          }
        }
      )
      reply.code(200).send({ entryPointUrl: machineHost })
    }
  })

  await execa('node', [
    cliPath, 'deploy',
    '--keys', pathToKeys,
    '--config', pathToConfig,
    '--deploy-service-host', deployServiceHost
  ], {
    cwd: join(import.meta.url, './fixtures/app-to-deploy')
  })
})

test('should deploy to a dynamic workspace with a keys option', async (t) => {
  const workspaceId = 'b3d7f7e0-8c03-11e8-9eb6-529269fb1459'
  const workspaceKey = 'b3d7f7e08c0311e89eb6529269fb1459'
  const label = 'cli:deploy-2'

  const pathToConfig = join(import.meta.url, './fixtures/app-to-deploy/platformatic.db.json')
  const pathToKeys = join(import.meta.url, './fixtures/app-to-deploy/dynamic.txt')

  const machineHost = await startMachine(t)
  const deployServiceHost = await startDeployService(t, {
    createBundleCallback: (request, reply) => {
      t.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
      t.equal(request.headers['x-platformatic-api-key'], workspaceKey)
      t.match(request.body, {
        bundle: {
          appType: 'db',
          configPath: 'platformatic.db.json'
        }
      })
      t.ok(request.body.bundle.checksum)
    },
    createDeploymentCallback: (request, reply) => {
      t.equal(request.headers['x-platformatic-workspace-id'], workspaceId)
      t.equal(request.headers['x-platformatic-api-key'], workspaceKey)
      t.same(
        request.body,
        {
          label,
          metadata: {
            appType: 'db'
          },
          variables: {
            PLT_ENV_VARIABLE1: 'platformatic_variable1',
            PLT_ENV_VARIABLE2: 'platformatic_variable2'
          },
          secrets: {
            PLT_SECRET_1: 'platformatic_secret_1',
            PLT_SECRET_2: 'platformatic_secret_2'
          }
        }
      )
      reply.code(200).send({ entryPointUrl: machineHost })
    }
  })

  await execa('node', [
    cliPath, 'deploy',
    '--keys', pathToKeys,
    '--config', pathToConfig,
    '--label', label,
    '--deploy-service-host', deployServiceHost
  ])
})

test('should throw if workspace env file is wrong', async (t) => {
  const pathToConfig = join(import.meta.url, './fixtures/app-to-deploy/platformatic.db.json')
  const pathToKeys = join(import.meta.url, './fixtures/app-to-deploy/wrong.txt')

  try {
    await execa('node', [
      cliPath, 'deploy',
      '--keys', pathToKeys,
      '--config', pathToConfig
    ])
    t.fail('should have failed')
  } catch (err) {
    t.ok(err.message.includes('Could not find workspace keys in provided file.'))
  }
})
