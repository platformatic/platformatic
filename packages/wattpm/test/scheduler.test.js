import fastify from 'fastify'
import { equal, ok } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { prepareRuntime } from '../../basic/test/helper.js'
import { updateConfigFile } from '../../runtime/test/helpers.js'
import { waitForStart, wattpm } from './helper.js'

test('scheduler commands should list, pause, run, and resume scheduler jobs', async t => {
  const target = fastify()
  const calls = []
  target.get('/test', async () => {
    calls.push(Date.now())
    return { ok: true }
  })
  await target.listen({ port: 0 })
  t.after(() => target.close())

  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const callbackUrl = `http://localhost:${target.server.address().port}/test`
  await updateConfigFile(resolve(rootDir, 'watt.json'), config => {
    config.scheduler = [
      {
        name: 'cli-test',
        cron: '0 0 1 1 *',
        callbackUrl,
        method: 'GET'
      }
    ]
    return config
  })

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess)
  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const runtimeId = startProcess.pid.toString()
  const schedulerProcess = await wattpm('scheduler', runtimeId, { cwd: rootDir })
  ok(schedulerProcess.stdout.includes('cli-test'))
  ok(schedulerProcess.stdout.includes('Source'))

  const pausedProcess = await wattpm('scheduler:pause', runtimeId, 'cli-test', { cwd: rootDir })
  const pausedJob = JSON.parse(pausedProcess.stdout)
  equal(pausedJob.name, 'cli-test')
  equal(pausedJob.paused, true)

  const runProcess = await wattpm('scheduler:run', runtimeId, 'cli-test', { cwd: rootDir })
  const runResult = JSON.parse(runProcess.stdout)
  equal(runResult.name, 'cli-test')
  equal(runResult.success, true)
  equal(calls.length, 1)

  const resumedProcess = await wattpm('scheduler:resume', runtimeId, 'cli-test', { cwd: rootDir })
  const resumedJob = JSON.parse(resumedProcess.stdout)
  equal(resumedJob.name, 'cli-test')
  equal(resumedJob.paused, false)
})

test('scheduler help should document all commands', async () => {
  for (const command of ['scheduler', 'scheduler:pause', 'scheduler:resume', 'scheduler:run']) {
    const helpProcess = await wattpm('help', command)
    ok(helpProcess.stdout.startsWith(`\nUsage: wattpm ${command}`))
  }
})
