import { ok } from 'node:assert'
import { on } from 'node:events'
import { test } from 'node:test'
import split2 from 'split2'
import { prepareRuntime } from '../../basic/test/helper.js'
import { wattpm } from './helper.js'

test('should use pretty printing by default', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('start', rootDir, { env: { FORCE_TTY: 'true' } })

  for await (const raw of on(startProcess.stdout.pipe(split2()), 'data')) {
    const log = raw.toString()
    ok(!log.startsWith('{'))

    if (log.includes('Server listening')) {
      break
    }
  }
})

test('should not use pretty printing if requested to', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('-r', 'start', rootDir, { env: { FORCE_TTY: 'true' } })

  for await (const raw of on(startProcess.stdout.pipe(split2()), 'data')) {
    const log = raw.toString()
    ok(log.startsWith('{'))

    if (log.includes('Server listening')) {
      break
    }
  }
})
