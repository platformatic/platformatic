import { deepStrictEqual, ok, rejects } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { transform } from '../index.js'
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

test('starts applications according to their implicit or explicit dependencies, in order', async t => {
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

  // Applications start in dependency level order: each level starts only after
  // the previous level is fully done. Levels are:
  //   level 0: service-1 (no deps)
  //   level 1: service-2 (depends on service-1)
  //   level 2: composer (depends on service-1, service-2)
  deepStrictEqual(startLogs, [
    'Starting the worker 0 of the application "service-1"...',
    'Started the worker 0 of the application "service-1"...',
    'Starting the worker 0 of the application "service-2"...',
    'Started the worker 0 of the application "service-2"...',
    'Starting the worker 0 of the application "composer"...',
    'Started the worker 0 of the application "composer"...'
  ])
})

/*
  The application service-3 will fail after 1.5s.
  With dependency-level startup, service-3 and service-1 are in the same level (no deps).
  When service-3 fails, the level fails and subsequent levels (service-2, composer) never start.
*/
test('stops startup when a dependency level fails', async t => {
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

  ok(hasLog(startLogs, 'runtime', 'Failed to start worker 0 of the application "service-3": Service 3 failed to start'))
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

test('should throw if circular dependencies are detected', async t => {
  const context = {}
  const configFile = join(fixturesDir, 'circular-dependencies', 'platformatic.json')
  const runtime = await createRuntime(configFile, null, context)

  t.after(async () => {
    await runtime.close()
  })

  await rejects(
    () => runtime.start(),
    /Detected a cycle in the applications dependencies: application-1 -> application-2 -> application-1/
  )
})

test('startupConcurrency config option takes precedence over context.concurrency', async t => {
  const context = {
    concurrency: 10,
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.startupConcurrency = 1
      return config
    }
  }
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

test('startupConcurrency has a minimum bound of 1', async t => {
  const context = {
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.startupConcurrency = 0
      return config
    }
  }
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
