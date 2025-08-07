import { deepStrictEqual, ok } from 'node:assert'
import { on } from 'node:events'
import { resolve } from 'node:path'
import { test } from 'node:test'
import split2 from 'split2'
import { ensureDependencies, prepareRuntime, updateFile } from '../../basic/test/helper.js'
import { changeWorkingDirectory, prepareGitRepository, waitForStart, wattpm, wattpmUtils } from './helper.js'

test('start - should use default folders for resolved services', async t => {
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

  let started = false
  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    const parsed = JSON.parse(log.toString())

    if (parsed.msg.startsWith('Started the service "resolved"')) {
      started = true
      break
    }
  }

  await waitForStart(startProcess)
  ok(started)
})

test('start - should throw an error when a service has not been resolved', async t => {
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
          'The path for service "resolved" does not exist. Please run "wattpm resolve" and try again.'
        )
      }),
    startProcess.stdout
  )
})
