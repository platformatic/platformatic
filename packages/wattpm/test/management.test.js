import fastifyWebsocket from '@fastify/websocket'
import { createDirectory, safeRemove } from '@platformatic/foundation'
import { version } from '@platformatic/runtime'
import { updateConfigFile } from '@platformatic/runtime/test/helpers.js'
import fastify from 'fastify'
import { deepStrictEqual, ok } from 'node:assert'
import { randomUUID } from 'node:crypto'
import { platform, tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { prepareRuntime } from '../../basic/test/helper.js'
import { waitForStart, wattpm } from './helper.js'

test('ps - should show running applications', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const psProcess = await wattpm('ps')
  const lines = psProcess.stdout.split('\n').map(l =>
    l
      .split('|')
      .map(t => t.trim())
      .filter(t => t))

  deepStrictEqual(lines[2], ['PID', 'Name', 'Version', 'Uptime', 'Directory'])

  const main = lines.find(l => l[1] === 'main')
  deepStrictEqual(main[0], startProcess.pid.toString())
  deepStrictEqual(main[2], version)
  ok(main[3].match(/now|(\d+s)/))
})

test('ps - should support custom sockets', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const socketPath =
    platform() === 'win32' ? `\\\\.\\pipe\\platformatic-${randomUUID()}` : resolve(tmpdir(), `platformatic-${randomUUID()}.sock`)

  await updateConfigFile(resolve(rootDir, 'watt.json'), config => {
    config.managementApi = { socket: socketPath }

    return config
  })

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const psProcess = await wattpm('-S', socketPath, 'ps')
  const lines = psProcess.stdout.split('\n').map(l =>
    l
      .split('|')
      .map(t => t.trim())
      .filter(t => t))

  deepStrictEqual(lines[2], ['PID', 'Name', 'Version', 'Uptime', 'Directory'])

  const main = lines.find(l => l[1] === 'main')
  deepStrictEqual(main[0], startProcess.pid.toString())
  deepStrictEqual(main[2], version)
  ok(main[3].match(/now|(\d+s)/))
})

test('ps - should warn when no runtimes are available', async t => {
  const logsProcess = await wattpm('ps')

  deepStrictEqual(logsProcess.exitCode, 0)
  ok(logsProcess.stdout.includes('No runtimes found.'))
})

test('ps - should warn when some runtimes error during metadata retrieval', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess)

  // Create a dummy socket that will reply with an error
  const runtimePID = Math.floor(1e6 + Math.random() * 1e9).toString()
  const runtimePIDDir = resolve(tmpdir(), 'platformatic', 'runtimes', runtimePID)
  await createDirectory(runtimePIDDir, true)

  let socketPath = null
  if (platform() === 'win32') {
    socketPath = '\\\\.\\pipe\\platformatic-' + runtimePID.toString()
  } else {
    socketPath = resolve(runtimePIDDir, 'socket')
  }

  const server = fastify()
  server.register(fastifyWebsocket)
  server.get('/api/v1/metadata', async () => {
    throw new Error('KABOOM!')
  })
  await server.listen({ path: socketPath })

  t.after(async () => {
    await server.close()
    await safeRemove(runtimePIDDir)
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const psProcess = await wattpm('ps')
  const lines = psProcess.stdout
    .split('\n')
    .slice(-7)
    .map(l =>
      l
        .split('|')
        .map(t => t.trim())
        .filter(t => t))

  deepStrictEqual(lines[2], ['PID', 'Name', 'Version', 'Uptime', 'Directory'])

  ok(psProcess.stdout.includes('Failed to retrieve metadata for runtime with PID ' + runtimePID))
  ok(psProcess.stdout.includes('"code": "PLT_CTR_FAILED_TO_GET_RUNTIME_METADATA"'))
  ok(psProcess.stdout.includes('KABOOM!'))

  const main = lines.find(l => l[1] === 'main')
  deepStrictEqual(main[0], startProcess.pid.toString())
  deepStrictEqual(main[2], version)
  ok(main[3].match(/now|(\d+s)/))
})

test('applications - should list applications for an application with no workers information in development mode', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  const startProcess = wattpm('dev', rootDir)
  await waitForStart(startProcess)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const applicationsProcess = await wattpm('applications', 'main')
  const lines = applicationsProcess.stdout.split('\n').map(l =>
    l
      .split('|')
      .map(t => t.trim())
      .filter(t => t))

  deepStrictEqual(lines[2], ['Name', 'Type'])
  deepStrictEqual(lines[4], ['alternative', 'nodejs'])
  deepStrictEqual(lines[5], ['main', 'nodejs'])
})

test('applications - should list applications for an application with workers information in production mode', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', true, 'watt.json')

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const applicationsProcess = await wattpm('applications', 'main')
  const lines = applicationsProcess.stdout.split('\n').map(l =>
    l
      .split('|')
      .map(t => t.trim())
      .filter(t => t))

  deepStrictEqual(lines[2], ['Name', 'Workers', 'Type'])
  deepStrictEqual(lines[4], ['alternative', '1', 'nodejs'])
  deepStrictEqual(lines[5], ['main', '1', 'nodejs'])
})

test('applications - should complain when a runtime is not found', async t => {
  const applicationsProcess = await wattpm('applications', 'p-' + Date.now.toString(), { reject: false })

  deepStrictEqual(applicationsProcess.exitCode, 1)
  ok(applicationsProcess.stdout.includes('Cannot find a matching runtime.'))
})

test('env - should list environment variable for a server', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const envProcess = await wattpm('env', 'main')
  ok(envProcess.stdout.includes('RUNTIME_ENV=foo'))
})

test('env - should list environment variable for an application in tabular way', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const envProcess = await wattpm('env', '-t', 'main')
  ok(envProcess.stdout.match(/\|\s+RUNTIME_ENV\s+\|\s+foo/))
})

test('env - should list environment variable for an application', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const envProcess = await wattpm('env', 'main', 'main')
  ok(envProcess.stdout.includes('APPLICATION_ENV=bar'))
})

test('env - should complain when a runtime is not found', async t => {
  const envProcess = await wattpm('env', 'p-' + Date.now.toString(), { reject: false })

  deepStrictEqual(envProcess.exitCode, 1)
  ok(envProcess.stdout.includes('Cannot find a matching runtime.'))
})

test('env - should complain when an application is not found', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const envProcess = await wattpm('env', 'main', 'invalid', { reject: false })

  deepStrictEqual(envProcess.exitCode, 1)
  ok(envProcess.stdout.includes('Cannot find a matching application.'))
})
