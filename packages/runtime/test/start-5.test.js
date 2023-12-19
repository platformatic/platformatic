'use strict'
const assert = require('node:assert')
const { spawn } = require('node:child_process')
const { once } = require('node:events')
const { join } = require('node:path')
const { test } = require('node:test')
const fixturesDir = join(__dirname, '..', 'fixtures')

const why = require('why-is-node-running')
setTimeout(() => {
  console.log('-----------------start-5 - start')
  why()
  console.log('-----------------start-5 - end')
}, 40000).unref()

test('handles uncaught exceptions with db app', async (t) => {
  console.log('start-5 1 started')
  // Test for https://github.com/platformatic/platformatic/issues/1193
  const scriptFile = join(fixturesDir, 'start-command-in-runtime.js')
  const configFile = join(fixturesDir, 'dbApp', 'platformatic.db.json')
  console.log('start-5 1.1')
  const child = spawn(process.execPath, [scriptFile, configFile, '/async_crash'])
  console.log('start-5 1.2')
  child.stdout.pipe(process.stdout)
  child.stderr.pipe(process.stderr)
  console.log('start-5 1.3')
  const [exitCode] = await once(child, 'exit')
  console.log('start-5 1.4')

  t.after(async () => {
    console.log('close start-5.1')
    child.kill('SIGINT')
    console.log('close start-5.2')
  })

  console.log('start-5 1.5')
  assert.strictEqual(exitCode, 42)
  console.log('start-5 1 finished')
})
