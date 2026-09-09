import { safeRemove } from '@platformatic/foundation'
import { ok } from 'node:assert'
import { cp, readFile, symlink } from 'node:fs/promises'
import { platform } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import WebSocket from 'ws'
import { configurationFileIn, createRuntime, createTemporaryDirectory, getTempDir, updateConfigFile } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should get runtime logs via management api', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = configurationFileIn(projectDir)
  const app = await createRuntime(configFile)

  await app.init()

  t.after(async () => {
    await app.close()
  })

  const socketPath = app.getManagementApiUrl()

  const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
  const webSocket = new WebSocket(protocol + socketPath + ':/api/v1/logs/live')

  const promise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout'))
    }, 3000)

    webSocket.on('error', err => {
      reject(err)
    })

    webSocket.on('message', data => {
      if (data.includes('Platformatic is now listening')) {
        clearTimeout(timeout)

        setImmediate(() => {
          webSocket.terminate()
          resolve()
        })
      }
    })
  })

  await app.start()
  await promise
})

test('should support custom use transport', async t => {
  /*
    v4 allows exactly one configuration per directory, so this variant cannot be the sibling file
    it used to be. The fixture is copied and the copy is what gets the transport.
  */
  const root = await createTemporaryDirectory(t, 'management-api')
  await cp(join(fixturesDir, 'management-api'), root, { recursive: true })
  // In place the fixture resolves its capabilities from the package's node_modules; the copy is
  // outside that tree, so it is given the same directory rather than a hand-picked subset.
  await symlink(join(import.meta.dirname, '../../node_modules'), join(root, 'node_modules'), 'dir')

  const logsPath = join(await getTempDir(), 'platformatic-management-api-logs.txt')
  await safeRemove(logsPath)

  const configWithLoggerPath = configurationFileIn(root)
  await updateConfigFile(configWithLoggerPath, config => {
    config.logger = {
      level: 'trace',
      transport: {
        target: 'pino/file',
        options: { destination: logsPath }
      }
    }
  })

  const app = await createRuntime(configWithLoggerPath)
  await app.init()

  t.after(async () => {
    await app.close()
    await safeRemove(logsPath)
  })

  const socketPath = app.getManagementApiUrl()

  const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
  const webSocket = new WebSocket(protocol + socketPath + ':/api/v1/logs/live')

  const promise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout'))
    }, 30_000)

    webSocket.on('error', err => {
      reject(err)
    })

    webSocket.on('message', data => {
      if (data.toString().includes('Platformatic is now listening at')) {
        clearTimeout(timeout)
        webSocket.close()
        resolve()
      }
    })
  })

  await app.start()
  await promise

  // Wait for logs to be written
  await sleep(1_000)

  const logs = await readFile(logsPath, 'utf8')
  ok(logs.includes('Platformatic is now listening at'))
})
