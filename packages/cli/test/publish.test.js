import assert from 'assert/strict'
import { test } from 'node:test'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { writeFile, rm } from 'node:fs/promises'
import { execa } from 'execa'

import { cliPath, startDeployService } from './helper.js'

test('should publish stackable', async (t) => {
  const orgId = randomUUID()
  const orgName = 'test-org'

  const userApiKey = randomUUID()
  const npmPackageName = 'test-stackable'

  const pltConfigPath = `${tmpdir()}/config-${userApiKey}.json`
  await writeFile(pltConfigPath, JSON.stringify({ userApiKey }))
  t.after(async () => { await rm(pltConfigPath) })

  const deployServiceHost = await startDeployService(t, {
    getOrganizationsCallback: async (request, reply) => {
      reply.send({
        orgs: [
          { id: orgId, name: orgName }
        ]
      })
    },
    publishCallback: async (request, reply) => {
      const { orgId: requestOrgId, npmPackageName } = request.body
      assert.equal(requestOrgId, orgId)
      assert.equal(npmPackageName, 'test-stackable')
    }
  })

  await execa('node', [
    cliPath, 'publish',
    '--org-name', orgName,
    '--plt-config', pltConfigPath,
    '--npm-package-name', npmPackageName,
    '--publish-service-host', deployServiceHost
  ])
})

test('should not ask to choose an org if there is only one', async (t) => {
  const orgId = randomUUID()
  const orgName = 'test-org'

  const userApiKey = randomUUID()
  const npmPackageName = 'test-stackable'

  const pltConfigPath = `${tmpdir()}/config-${userApiKey}.json`
  await writeFile(pltConfigPath, JSON.stringify({ userApiKey }))
  t.after(async () => { await rm(pltConfigPath) })

  const deployServiceHost = await startDeployService(t, {
    getOrganizationsCallback: async (request, reply) => {
      reply.send({
        orgs: [
          { id: orgId, name: orgName }
        ]
      })
    },
    publishCallback: async (request, reply) => {
      const { orgId: requestOrgId, npmPackageName } = request.body
      assert.equal(requestOrgId, orgId)
      assert.equal(npmPackageName, 'test-stackable')
    }
  })

  await execa('node', [
    cliPath, 'publish',
    '--plt-config', pltConfigPath,
    '--npm-package-name', npmPackageName,
    '--publish-service-host', deployServiceHost
  ])
})

test('should throw if there is no orgs', async (t) => {
  const userApiKey = randomUUID()
  const npmPackageName = 'test-stackable'

  const pltConfigPath = `${tmpdir()}/config-${userApiKey}.json`
  await writeFile(pltConfigPath, JSON.stringify({ userApiKey }))
  t.after(async () => { await rm(pltConfigPath) })

  const deployServiceHost = await startDeployService(t, {
    getOrganizationsCallback: async (request, reply) => {
      reply.send({ orgs: [] })
    }
  })

  try {
    await execa('node', [
      cliPath, 'publish',
      '--plt-config', pltConfigPath,
      '--npm-package-name', npmPackageName,
      '--publish-service-host', deployServiceHost
    ])
    assert.fail('should have failed')
  } catch (err) {
    assert.ok(err.message.includes('You do not have any organisations.'))
  }
})

test('should throw if get organizations fails', async (t) => {
  const userApiKey = randomUUID()
  const npmPackageName = 'test-stackable'

  const pltConfigPath = `${tmpdir()}/config-${userApiKey}.json`
  await writeFile(pltConfigPath, JSON.stringify({ userApiKey }))
  t.after(async () => { await rm(pltConfigPath) })

  const deployServiceHost = await startDeployService(t, {
    getOrganizationsCallback: async (request, reply) => {
      throw new Error('get organizations failed')
    }
  })

  try {
    await execa('node', [
      cliPath, 'publish',
      '--plt-config', pltConfigPath,
      '--npm-package-name', npmPackageName,
      '--publish-service-host', deployServiceHost
    ])
    assert.fail('should have failed')
  } catch (err) {
    assert.ok(err.message.includes('Could not fetch user ogranisations'))
  }
})

test('should publish stackable', async (t) => {
  const orgId = randomUUID()
  const orgName = 'test-org'

  const userApiKey = randomUUID()
  const npmPackageName = 'test-stackable'

  const pltConfigPath = `${tmpdir()}/config-${userApiKey}.json`
  await writeFile(pltConfigPath, JSON.stringify({ userApiKey }))
  t.after(async () => { await rm(pltConfigPath) })

  const deployServiceHost = await startDeployService(t, {
    getOrganizationsCallback: async (request, reply) => {
      reply.send({
        orgs: [
          { id: orgId, name: orgName }
        ]
      })
    },
    publishCallback: async (request, reply) => {
      const { orgId: requestOrgId, npmPackageName } = request.body
      assert.equal(requestOrgId, orgId)
      assert.equal(npmPackageName, 'test-stackable')

      throw new Error('publish stackable failed')
    }
  })

  try {
    await execa('node', [
      cliPath, 'publish',
      '--org-name', orgName,
      '--plt-config', pltConfigPath,
      '--npm-package-name', npmPackageName,
      '--publish-service-host', deployServiceHost
    ])
    assert.fail('should have failed')
  } catch (err) {
    assert.ok(err.message.includes('Could not publish stackable'))
  }
})

test('should throw user api key is not found', async (t) => {
  const orgId = randomUUID()
  const orgName = 'test-org'

  const userApiKey = randomUUID()
  const npmPackageName = 'test-stackable'

  const pltConfigPath = `${tmpdir()}/config-${userApiKey}.json`
  await writeFile(pltConfigPath, JSON.stringify({}))
  t.after(async () => { await rm(pltConfigPath) })

  const deployServiceHost = await startDeployService(t, {
    getOrganizationsCallback: async (request, reply) => {
      reply.send({
        orgs: [
          { id: orgId, name: orgName }
        ]
      })
    }
  })

  try {
    await execa('node', [
      cliPath, 'publish',
      '--org-name', orgName,
      '--plt-config', pltConfigPath,
      '--npm-package-name', npmPackageName,
      '--publish-service-host', deployServiceHost
    ])
    assert.fail('should have failed')
  } catch (err) {
    assert.ok(err.message.includes('Could not find user api key.'))
  }
})

test('should throw if there is no org with this name', async (t) => {
  const orgId = randomUUID()
  const orgName = 'test-org'

  const userApiKey = randomUUID()
  const npmPackageName = 'test-stackable'

  const pltConfigPath = `${tmpdir()}/config-${userApiKey}.json`
  await writeFile(pltConfigPath, JSON.stringify({ userApiKey }))
  t.after(async () => { await rm(pltConfigPath) })

  const deployServiceHost = await startDeployService(t, {
    getOrganizationsCallback: async (request, reply) => {
      reply.send({
        orgs: [
          { id: orgId, name: orgName }
        ]
      })
    }
  })

  try {
    await execa('node', [
      cliPath, 'publish',
      '--org-name', 'other-org',
      '--plt-config', pltConfigPath,
      '--npm-package-name', npmPackageName,
      '--publish-service-host', deployServiceHost
    ])
    assert.fail('should have failed')
  } catch (err) {
    assert.ok(err.message.includes('Could not find organisation: "other-org".'))
  }
})
