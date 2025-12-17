import assert from 'node:assert'
import { once } from 'node:events'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { RuntimeApiClient } from '../lib/index.js'
import { kill, startRuntime } from './helper.js'

const fixturesDir = join(import.meta.dirname, 'fixtures')

test('should get runtime application REPL WebSocket', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')

  const { runtime } = await startRuntime(configFile)
  t.after(async () => {
    await kill(runtime)
  })

  const runtimeClient = new RuntimeApiClient()
  t.after(async () => {
    await runtimeClient.close()
  })

  // Get the application to use for the REPL
  const applications = await runtimeClient.getRuntimeApplications(runtime.pid)
  const applicationId = applications.entrypoint

  // Connect to the REPL
  const ws = runtimeClient.getRuntimeApplicationRepl(runtime.pid, applicationId)

  // Wait for connection
  await new Promise((resolve, reject) => {
    ws.on('open', resolve)
    ws.on('error', reject)
  })

  // Collect output
  let output = ''
  ws.on('message', (data) => {
    output += data.toString()
  })

  // Wait for prompt
  await sleep(200)

  assert.ok(output.includes('>'), 'Should receive REPL prompt')

  // Send a simple expression
  ws.send('1 + 2\n')

  // Wait for result
  await sleep(200)

  assert.ok(output.includes('3'), 'Should evaluate and return result')

  // Close the WebSocket
  ws.close()
})

test('should have access to platformatic in REPL context', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')

  const { runtime } = await startRuntime(configFile)
  t.after(async () => {
    await kill(runtime)
  })

  const runtimeClient = new RuntimeApiClient()
  t.after(async () => {
    await runtimeClient.close()
  })

  const applications = await runtimeClient.getRuntimeApplications(runtime.pid)
  const applicationId = applications.entrypoint

  const ws = runtimeClient.getRuntimeApplicationRepl(runtime.pid, applicationId)

  await new Promise((resolve, reject) => {
    ws.on('open', resolve)
    ws.on('error', reject)
  })

  let output = ''
  ws.on('message', (data) => {
    output += data.toString()
  })

  await sleep(200)

  // Check platformatic is available
  ws.send('typeof platformatic\n')
  await sleep(200)

  assert.ok(output.includes("'object'"), 'platformatic should be available')

  ws.close()
})

test('should handle REPL exit', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')

  const { runtime } = await startRuntime(configFile)
  t.after(async () => {
    await kill(runtime)
  })

  const runtimeClient = new RuntimeApiClient()
  t.after(async () => {
    await runtimeClient.close()
  })

  const applications = await runtimeClient.getRuntimeApplications(runtime.pid)
  const applicationId = applications.entrypoint

  const ws = runtimeClient.getRuntimeApplicationRepl(runtime.pid, applicationId)

  await new Promise((resolve, reject) => {
    ws.on('open', resolve)
    ws.on('error', reject)
  })

  await sleep(200)

  // Send .exit command
  ws.send('.exit\n')

  // Wait for WebSocket to close
  await once(ws, 'close')

  assert.ok(true, 'WebSocket should close after .exit')
})
