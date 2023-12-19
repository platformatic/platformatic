'use strict'
const assert = require('node:assert')
const { spawn } = require('node:child_process')
const { once } = require('node:events')
const { join } = require('node:path')
const { test } = require('node:test')
const fixturesDir = join(__dirname, '..', 'fixtures')

const why = require('why-is-node-running')
setTimeout(() => {
  console.log('-----------------start-1 - start')
  why()
  console.log('-----------------start-1 - end')
}, 40000).unref()

test('handles uncaught exceptions with db app', async (t) => {
  // Test for https://github.com/platformatic/platformatic/issues/1193
  const scriptFile = join(fixturesDir, 'start-command-in-runtime.js')
  const configFile = join(fixturesDir, 'dbApp', 'platformatic.db.json')
  const child = spawn(process.execPath, [scriptFile, configFile, '/async_crash'])
  child.stdout.pipe(process.stdout)
  child.stderr.pipe(process.stderr)
  const [exitCode] = await once(child, 'exit')

  t.after(async () => {
    child.kill('SIGINT')
  })

  assert.strictEqual(exitCode, 42)
})
