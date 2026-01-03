import { deepStrictEqual, ok } from 'node:assert'
import { on } from 'node:events'
import { resolve } from 'node:path'
import { test } from 'node:test'
import split2 from 'split2'
import { ensureDependencies, prepareRuntime, updateFile } from '../../basic/test/helper.js'
import { changeWorkingDirectory, prepareGitRepository, wattpm, wattpmUtils } from './helper.js'

test('start - should use default folders for resolved applications', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  await prepareGitRepository(t, rootDir)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  changeWorkingDirectory(t, rootDir)
  await wattpmUtils('import', rootDir, '-H', '-i', 'resolved', '{PLT_GIT_REPO_URL}')
  await wattpmUtils('resolve', rootDir)
  await updateFile(resolve(rootDir, 'external/resolved/package.json'), content => {
    const config = JSON.parse(content)
    config.dependencies = { '@platformatic/node': '^2.8.0' }
    return JSON.stringify(config, null, 2)
  })

  await ensureDependencies([resolve(rootDir, 'external/resolved')])

  const startProcess = wattpm('start', rootDir)

  // Use a single stream consumer to avoid race conditions between
  // multiple pipe(split2()) calls losing messages
  let started = false
  let url
  startProcess.stderr?.pipe(startProcess.stdout)

  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    if (process.env.PLT_TESTS_DEBUG === 'true') {
      process._rawDebug(log.toString())
    }

    let parsed
    try {
      parsed = JSON.parse(log.toString())
    } catch {
      continue
    }

    if (parsed.msg?.startsWith('Started the worker 0 of the application "resolved"')) {
      started = true
    }

    const mo = parsed.msg?.match(/Platformatic is now listening at (.+)/)
    if (mo) {
      url = mo[1]
      break
    }
  }

  ok(started, 'Expected worker 0 of "resolved" application to start')
  ok(url, 'Expected Platformatic to be listening')
})

test('start - should throw an error when an application has not been resolved', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  await prepareGitRepository(t, rootDir)

  changeWorkingDirectory(t, rootDir)
  await wattpmUtils('import', rootDir, '-H', '-i', 'resolved', '{PLT_GIT_REPO_URL}')

  const startProcess = await wattpm('start', rootDir, { reject: false })

  deepStrictEqual(startProcess.exitCode, 1)
  ok(
    startProcess.stdout
      .trim()
      .split('\n')
      .find(l => {
        return (
          JSON.parse(l).msg ===
          'The path for application "resolved" does not exist. Please run "wattpm resolve" and try again.'
        )
      }),
    startProcess.stdout
  )
})
