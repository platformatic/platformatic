import { ok, strictEqual } from 'node:assert'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { platform } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('correctly applies the runtime graceful shutdown timeout', { skip: platform() === 'win32' }, async () => {
  const scriptFile = join(fixturesDir, 'delayed-shutdown', 'start-and-stop.js')
  const configFile = join(fixturesDir, 'delayed-shutdown', 'platformatic.runtime.json')
  const child = spawn(process.execPath, [scriptFile, configFile])

  let stderr = ''
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', data => {
    stderr += data
  })

  const [exitCode] = await once(child, 'exit')

  strictEqual(exitCode, 1)
  ok(stderr.trim().endsWith('killed by timeout (1000ms)'))
})
