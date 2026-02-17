import { equal, ok, strictEqual } from 'node:assert'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { platform } from 'node:os'
import { test } from 'node:test'
import { Client } from 'undici'
import { transform } from '../../index.js'
import { createRuntime, createTemporaryDirectory } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should use custom socket path when specified', async t => {
  // Skip on Windows as named pipes work differently
  if (platform() === 'win32') {
    t.skip('Custom socket path test skipped on Windows')
    return
  }

  const tempDir = await createTemporaryDirectory(t, 'custom-socket')
  const customSocketPath = join(tempDir, 'custom.sock')

  const projectDir = join(fixturesDir, 'management-api-without-metrics')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile, undefined, {
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.managementApi = {
        socket: customSocketPath
      }
      return config
    }
  })

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Verify the socket was created at the custom path
  ok(existsSync(customSocketPath), 'Custom socket should exist')

  // Verify we can connect to the socket
  const socketUrl = app.getManagementApiUrl()
  equal(socketUrl, customSocketPath, 'Management API URL should be the custom socket path')

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: customSocketPath,
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  t.after(async () => {
    await client.close()
  })

  // Verify the management API works via the custom socket
  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/metadata'
  })

  strictEqual(statusCode, 200)

  const metadata = await body.json()
  equal(metadata.pid, process.pid)
})

test('should use default socket path when managementApi is true', async t => {
  const projectDir = join(fixturesDir, 'management-api-without-metrics')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const socketUrl = app.getManagementApiUrl()
  ok(socketUrl, 'Management API URL should be set')

  // On Unix, the default path should contain the PID
  if (platform() !== 'win32') {
    ok(socketUrl.includes(process.pid.toString()), 'Default socket path should contain the PID')
  }
})

test('should use default socket path when managementApi is an object without socket property', async t => {
  const projectDir = join(fixturesDir, 'management-api-without-metrics')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile, undefined, {
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.managementApi = {
        logs: { maxSize: 100 }
      }
      return config
    }
  })

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const socketUrl = app.getManagementApiUrl()
  ok(socketUrl, 'Management API URL should be set')

  // On Unix, the default path should contain the PID
  if (platform() !== 'win32') {
    ok(socketUrl.includes(process.pid.toString()), 'Default socket path should contain the PID')
  }
})
