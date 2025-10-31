import { loadConfigurationFile } from '@platformatic/foundation'
import { deepStrictEqual, ok } from 'node:assert'
import { on } from 'node:events'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import split2 from 'split2'
import { request } from 'undici'
import { ensureDependencies, prepareRuntime } from '../../basic/test/helper.js'
import { changeWorkingDirectory, waitForStart, wattpm } from './helper.js'

test('applications:add - should add application to an existing app', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'dynamic', false, 'watt-1-only.json')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  changeWorkingDirectory(t, rootDir)
  ensureDependencies([resolve(rootDir, 'services/application-2')])
  await writeFile(
    'add.json',
    JSON.stringify([
      {
        id: 'application-2',
        path: './services/application-2'
      }
    ]),
    'utf-8'
  )

  // Start the application
  const startProcess = wattpm('start', '-c', 'watt-1-only.json', rootDir)
  let { url } = await waitForStart(startProcess)

  // Verify that the routes work properly
  {
    const res = await request(url + '/application-1/hello')
    deepStrictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { from: 'application-1' })
  }

  {
    const res = await request(url + '/application-2/hello')
    deepStrictEqual(res.statusCode, 404)
  }

  // Now add the application
  const addProcess = await wattpm('applications:add', 'add.json')
  ok(addProcess.stdout.includes('Successfully added 1 application to the application.'))

  // Wait for the entrypoint to restart
  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    const parsed = JSON.parse(log.toString())

    const mo = parsed.msg?.match(/ listening at (.+)/)
    if (mo) {
      url = mo[1]
      break
    }
  }

  // Verify that the new application is running
  {
    const res = await request(url + '/application-1/hello')
    deepStrictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { from: 'application-1' })
  }

  {
    const res = await request(url + '/application-2/hello')
    deepStrictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { from: 'application-2' })
  }
})

test('applications:add - should add application to an existing app and save changes to the application config', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'dynamic', false, 'watt-1-only.json')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  changeWorkingDirectory(t, rootDir)
  ensureDependencies([resolve(rootDir, 'services/application-2')])
  await writeFile(
    'add.json',
    JSON.stringify([
      {
        id: 'application-2',
        path: './services/application-2'
      }
    ]),
    'utf-8'
  )

  // Start the application
  const startProcess = wattpm('start', '-c', 'watt-1-only.json', rootDir)
  await waitForStart(startProcess)

  // Now add the application
  const addProcess = await wattpm('applications:add', '-s', 'add.json')
  ok(addProcess.stdout.includes('Successfully added 1 application to the application.'))

  const config = await loadConfigurationFile(resolve(rootDir, 'watt-1-only.json'))
  deepStrictEqual(config.applications, [
    {
      id: 'application-2',
      path: './services/application-2'
    }
  ])
})

test('applications:add - supports both JSON file and paths', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'dynamic', false, 'watt-1-only.json')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  changeWorkingDirectory(t, rootDir)
  ensureDependencies([resolve(rootDir, 'services/application-2')])
  ensureDependencies([resolve(rootDir, 'services/application-3')])
  await writeFile(
    'add.json',
    JSON.stringify([
      {
        id: 'application-2',
        path: './services/application-2',
        workers: 2
      }
    ]),
    'utf-8'
  )

  // Start the application
  const startProcess = wattpm('start', '-c', 'watt-1-only.json', rootDir)
  await waitForStart(startProcess)

  // Now add the application
  const addProcess = await wattpm('applications:add', '-s', 'add.json', './services/application-3')
  ok(addProcess.stdout.includes('Successfully added 2 applications to the application.'))

  const config = await loadConfigurationFile(resolve(rootDir, 'watt-1-only.json'))
  deepStrictEqual(config.applications, [
    {
      id: 'application-2',
      path: './services/application-2',
      workers: 2
    },
    {
      id: 'application-3',
      path: 'services/application-3'
    }
  ])
})

test('applications:add - fails if a path is not valid', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'dynamic', false, 'watt-1-only.json')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  changeWorkingDirectory(t, rootDir)

  // Start the application
  const startProcess = wattpm('start', '-c', 'watt-1-only.json', rootDir)
  await waitForStart(startProcess)

  // Now add the application
  const addProcess = await wattpm('applications:add', '-s', 'add.json', { reject: false })

  ok(addProcess.exitCode, 1)
  ok(addProcess.stdout.includes('does not exist or is not valid JSON'))
})

test('applications:add - fails if a path contains invalid JSON', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'dynamic', false, 'watt-1-only.json')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  changeWorkingDirectory(t, rootDir)
  ensureDependencies([resolve(rootDir, 'services/application-2')])
  ensureDependencies([resolve(rootDir, 'services/application-3')])
  await writeFile('add.json', 'whatever', 'utf-8')

  // Start the application
  const startProcess = wattpm('start', '-c', 'watt-1-only.json', rootDir)
  await waitForStart(startProcess)

  // Now add the application
  const addProcess = await wattpm('applications:add', '-s', 'add.json', { reject: false })

  ok(addProcess.exitCode, 1)
  ok(addProcess.stdout.includes('does not exist or is not valid JSON'))
})

test('applications:add - should complain when a runtime is not found', async t => {
  const addProcess = await wattpm('applications:add', 'p-' + Date.now.toString(), { reject: false })

  deepStrictEqual(addProcess.exitCode, 1)
  ok(addProcess.stdout.includes('Cannot find a matching runtime.'))
})

test('applications:remove - should remove applications from an existing app', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'dynamic', false, 'watt-all.json')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  changeWorkingDirectory(t, rootDir)

  // Start the application
  const startProcess = wattpm('start', '-c', 'watt-all.json', rootDir)
  let { url } = await waitForStart(startProcess)

  // Verify that the routes work properly
  {
    const res = await request(url + '/application-1/hello')
    deepStrictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { from: 'application-1' })
  }

  {
    const res = await request(url + '/application-2/hello')
    deepStrictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { from: 'application-2' })
  }

  {
    const res = await request(url + '/application-3/hello')
    deepStrictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { from: 'application-3' })
  }

  // Now add the application
  const removeProcess = await wattpm('applications:remove', 'application-2', 'application-3')
  ok(removeProcess.stdout.includes('Successfully removed 2 applications from the application.'))

  // Wait for the entrypoint to restart

  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    const parsed = JSON.parse(log.toString())

    const mo = parsed.msg?.match(/ listening at (.+)/)
    if (mo) {
      url = mo[1]
      break
    }
  }

  // Verify that the application-1 not running anymore
  {
    const res = await request(url + '/application-1/hello')
    deepStrictEqual(res.statusCode, 200)
    deepStrictEqual(await res.body.json(), { from: 'application-1' })
  }

  {
    const res = await request(url + '/application-2/hello')
    deepStrictEqual(res.statusCode, 404)
  }

  {
    const res = await request(url + '/application-3/hello')
    deepStrictEqual(res.statusCode, 404)
  }
})

for (const section of ['applications', 'services', 'web']) {
  test(`applications:remove - should remove application from an existing app and save changes to the application config (${section})`, async t => {
    const configFile = `watt-via-${section}.json`
    const { root: rootDir } = await prepareRuntime(t, 'dynamic', false, configFile)

    t.after(() => {
      startProcess.kill('SIGINT')
      return startProcess.catch(() => {})
    })

    changeWorkingDirectory(t, rootDir)

    // Start the application
    const startProcess = wattpm('start', '-c', configFile, rootDir)
    await waitForStart(startProcess)

    // Now add the application
    const removeProcess = await wattpm('applications:remove', '-s', 'application-2')
    ok(removeProcess.stdout.includes('Successfully removed 1 application from the application.'))

    const config = await loadConfigurationFile(resolve(rootDir, configFile))

    deepStrictEqual(config[section], [])
    deepStrictEqual(config.autoload, {
      path: './services',
      exclude: ['non-existent', 'application-2']
    })
  })
}

test('applications:add - should complain when a runtime is not found', async t => {
  const removeProcess = await wattpm('applications:remove', 'p-' + Date.now.toString(), { reject: false })

  deepStrictEqual(removeProcess.exitCode, 1)
  ok(removeProcess.stdout.includes('Cannot find a matching runtime.'))
})
