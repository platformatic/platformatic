import { ok } from 'node:assert'
import { on } from 'node:events'
import { test } from 'node:test'
import split2 from 'split2'
import { prepareRuntime } from '../../basic/test/helper.js'
import { wattpmUtils } from './helper.js'

test('should use pretty printing by default', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  t.after(() => {
    importProcess.kill('SIGINT')
    return importProcess.catch(() => {})
  })

  const importProcess = wattpmUtils('update', rootDir, { env: { FORCE_TTY: 'true' } })

  for await (const raw of on(importProcess.stdout.pipe(split2()), 'data')) {
    const log = raw.toString()
    ok(!log.startsWith('{'))

    if (log.includes('All dependencies have been updated.')) {
      break
    }
  }
})

test('should not use pretty printing if requested to', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  t.after(() => {
    importProcess.kill('SIGINT')
    return importProcess.catch(() => {})
  })

  const importProcess = wattpmUtils('-r', 'update', rootDir, { env: { FORCE_TTY: 'true' } })

  for await (const raw of on(importProcess.stdout.pipe(split2()), 'data')) {
    const log = raw.toString()

    ok(log.startsWith('{'))

    if (log.includes('All dependencies have been updated.')) {
      break
    }
  }
})
