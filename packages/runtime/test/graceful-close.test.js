import { ok, strictEqual } from 'node:assert'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { platform } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import split from 'split2'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('correctly applies the runtime graceful shutdown timeout', { skip: platform() === 'win32' }, async () => {
  const scriptFile = join(fixturesDir, 'delayed-shutdown', 'start-and-stop.js')
  const configFile = join(fixturesDir, 'delayed-shutdown', 'platformatic.runtime.json')
  const child = spawn(process.execPath, [scriptFile, configFile])

  const logs = []
  child.stdout.setEncoding('utf8')
  child.stdout.pipe(split(JSON.parse)).on('data', logs.push.bind(logs))

  const [exitCode] = await once(child, 'exit')

  strictEqual(exitCode, 1)
  ok(
    logs.find(
      m => m.level === 50 && m.msg === 'Could not close the runtime in 1000 ms, aborting the process with exit code 1.'
    )
  )
})
