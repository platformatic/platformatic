import { deepStrictEqual, ok, rejects } from 'node:assert'
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

function hasLog (logs, source, msg, dependencies, dependents) {
  return logs.find(l => {
    let dependenciesMatch = true
    let dependentsMatch = true

    if (dependencies) {
      dependenciesMatch = Array.isArray(l.dependencies) && dependencies.every(d => l.dependencies.includes(d))
    }

    if (dependents) {
      dependentsMatch = Array.isArray(l.dependents) && dependents.every(d => l.dependents.includes(d))
    }

    return l.source === source && l.msg === msg && dependenciesMatch && dependentsMatch
  })
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

  // With topological sort, service-1 starts before service-2 (since service-2 depends on service-1)
  // composer has no explicit deps so it starts first, but waits for implicit deps (gateway behavior)
  deepStrictEqual(startLogs, [
    'Starting the worker 0 of the application "composer"...',
    'Starting the worker 0 of the application "service-1"...',
    'Starting the worker 0 of the application "service-2"...',
    'Started the worker 0 of the application "service-1"...',
    'Started the worker 0 of the application "service-2"...',
    'Started the worker 0 of the application "composer"...'
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
  const startLogs = logs.filter(m => m.level === 30 || m.level === 50).map(extractLogs)

  ok(hasLog(startLogs, 'composer', 'Waiting for dependencies to start.', ['service-2', 'service-3', 'service-1']))
  ok(hasLog(startLogs, 'service-2', 'Waiting for dependencies to start.', ['service-1']))
  ok(hasLog(startLogs, 'runtime', 'Failed to start worker 0 of the application "service-3": Service 3 failed to start'))
  ok(
    hasLog(
      startLogs,
      'runtime',
      'Failed to start worker 0 of the application "composer": One of the service dependencies was unable to start.'
    )
  )

  ok(
    hasLog(
      startLogs,
      'runtime',
      'Failed to start worker 0 of the application "service-2": One of the service dependencies was unable to start.'
    )
  )
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
    'Starting the worker 0 of the application "service-1"...',
    'Started the worker 0 of the application "service-1"...',
    'Starting the worker 0 of the application "composer"...',
    'Started the worker 0 of the application "composer"...'
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

  const logs = allLogs.filter(m => m.level === 30 && m.msg.match(/stop/i)).map(extractLogs)

  deepStrictEqual(logs, [
    { source: 'runtime', msg: 'Stopping the worker 0 of the application "composer"...' },
    { source: 'runtime', msg: 'Stopped the worker 0 of the application "composer"...' },
    { source: 'runtime', msg: 'Stopping the worker 0 of the application "service-2"...' },
    { source: 'runtime', msg: 'Stopping the worker 0 of the application "service-1"...' },
    { source: 'service-1', msg: 'Waiting for dependents to stop.', dependents: ['service-2'] },
    { source: 'runtime', msg: 'Stopped the worker 0 of the application "service-2"...' },
    { source: 'runtime', msg: 'Stopped the worker 0 of the application "service-1"...' }
  ])
})

test('fails to start with circular dependencies', async t => {
  const context = {}
  const configFile = join(fixturesDir, 'parallel-management', 'platformatic.circular.runtime.json')
  const runtime = await createRuntime(configFile, null, context)

  t.after(async () => {
    await runtime.close()
  })

  await rejects(
    () => runtime.start(),
    (err) => {
      ok(err.message.includes('Circular dependency detected'))
      ok(err.message.includes('service-1'))
      ok(err.message.includes('service-2'))
      return true
    }
  )
})
