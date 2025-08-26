import { deepStrictEqual, rejects } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime, readLogs } from './helpers.js'
const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

function extractLogs (raw) {
  const log = { source: raw.name ?? 'runtime', msg: raw.msg }

  if (raw.dependencies) {
    log.dependencies = raw.dependencies
  }

  if (raw.dependents) {
    log.dependents = raw.dependents
  }

  return log
}

test('starts applications according to their implicit or explicit dependencies', async t => {
  const context = {}
  const configFile = join(fixturesDir, 'parallel-management', 'platformatic.runtime.json')
  const runtime = await createRuntime(configFile, null, context)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()
  await runtime.close()
  const logs = await readLogs(context.logsPath, 0)

  const startLogs = logs.filter(m => m.msg.startsWith('Start')).map(m => m.msg)

  deepStrictEqual(startLogs, [
    'Starting the application "composer"...',
    'Starting the application "service-2"...',
    'Starting the application "service-1"...',
    'Started the application "service-1"...',
    'Started the application "service-2"...',
    'Started the application "composer"...'
  ])
})

/*
  The application service-3 will fail after 1.5s.
  This will cause the runtime to stop all the other applications.
  Therefore composer and service-2 will report a failure in the logs.
*/
test('can abort waiting for dependencies if the runtime is stopped', async t => {
  const context = {}
  const configFile = join(fixturesDir, 'parallel-management', 'platformatic.with-failure.runtime.json')
  const runtime = await createRuntime(configFile, null, context)

  t.after(async () => {
    await runtime.close()
  })

  await rejects(() => runtime.start(), /Service 3 failed to start/)
  await runtime.close()
  const logs = await readLogs(context.logsPath, 0)

  deepStrictEqual(logs.filter(m => m.level === 30 || m.level === 50).map(extractLogs), [
    { source: 'runtime', msg: 'Starting the application "composer"...' },
    { source: 'runtime', msg: 'Starting the application "service-2"...' },
    { source: 'runtime', msg: 'Starting the application "service-3"...' },
    { source: 'runtime', msg: 'Starting the application "service-1"...' },
    {
      source: 'composer',
      msg: 'Waiting for dependencies to start.',
      dependencies: ['service-2', 'service-3', 'service-1']
    },
    { source: 'service-2', msg: 'Waiting for dependencies to start.', dependencies: ['service-1'] },
    { source: 'service-3', msg: 'The application threw an error.' },
    { source: 'runtime', msg: 'Failed to start application "service-3": Service 3 failed to start' },
    { source: 'runtime', msg: 'Stopping the application "composer"...' },
    { source: 'composer', msg: 'One of the service dependencies was unable to start.' },
    { source: 'runtime', msg: 'Stopped the application "composer"...' },
    {
      source: 'runtime',
      msg: 'Failed to start application "composer": One of the service dependencies was unable to start.'
    },
    { source: 'runtime', msg: 'Stopping the application "service-2"...' },
    { source: 'runtime', msg: 'Stopping the application "service-1"...' },
    { source: 'service-2', msg: 'One of the service dependencies was unable to start.' },
    { source: 'service-1', msg: 'Waiting for dependents to stop.', dependents: ['service-2'] },
    { source: 'runtime', msg: 'Stopped the application "service-2"...' },
    {
      source: 'runtime',
      msg: 'Failed to start application "service-2": One of the service dependencies was unable to start.'
    },
    { source: 'runtime', msg: 'Started the application "service-1"...' },
    { source: 'runtime', msg: 'Stopped the application "service-1"...' }
  ])
})

/*
  Setting concurrency to 1 here will force the runtime to start the applications sequentially.
  This means that when composer is started, service-2 is already started.
*/
test('does not wait for dependencies that have already been started', async t => {
  const context = { concurrency: 1 }
  const configFile = join(fixturesDir, 'parallel-management', 'platformatic.serial.runtime.json')
  const runtime = await createRuntime(configFile, null, context)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()
  await runtime.close()
  const logs = await readLogs(context.logsPath, 0)

  const startLogs = logs.filter(m => m.msg.startsWith('Start')).map(m => m.msg)

  deepStrictEqual(startLogs, [
    'Starting the application "service-1"...',
    'Started the application "service-1"...',
    'Starting the application "composer"...',
    'Started the application "composer"...'
  ])
})

test('applications wait for dependant applications before stopping', async t => {
  const context = {}
  const configFile = join(fixturesDir, 'parallel-management', 'platformatic.runtime.json')
  const runtime = await createRuntime(configFile, null, context)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()
  await runtime.close()
  const allLogs = await readLogs(context.logsPath, 0)

  const logs = allLogs.filter(m => m.level === 30 && !m.msg.includes('listening')).map(extractLogs)

  deepStrictEqual(logs, [
    { source: 'runtime', msg: 'Starting the application "composer"...' },
    { source: 'runtime', msg: 'Starting the application "service-2"...' },
    { source: 'runtime', msg: 'Starting the application "service-1"...' },
    { source: 'composer', msg: 'Waiting for dependencies to start.', dependencies: ['service-2', 'service-1'] },
    { source: 'service-2', msg: 'Waiting for dependencies to start.', dependencies: ['service-1'] },
    { source: 'runtime', msg: 'Started the application "service-1"...' },
    { source: 'service-1', msg: 'incoming request' },
    { source: 'service-1', msg: 'request completed' },
    { source: 'runtime', msg: 'Started the application "service-2"...' },
    { source: 'runtime', msg: 'Started the application "composer"...' },
    { source: 'runtime', msg: 'Stopping the application "composer"...' },
    { source: 'runtime', msg: 'Stopped the application "composer"...' },
    { source: 'runtime', msg: 'Stopping the application "service-2"...' },
    { source: 'runtime', msg: 'Stopping the application "service-1"...' },
    { source: 'service-1', msg: 'Waiting for dependents to stop.', dependents: ['service-2'] },
    { source: 'runtime', msg: 'Stopped the application "service-2"...' },
    { source: 'runtime', msg: 'Stopped the application "service-1"...' }
  ])
})
