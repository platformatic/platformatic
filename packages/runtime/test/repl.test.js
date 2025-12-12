import { ok, rejects } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('should start a REPL session for an application', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Start REPL and get the communication port
  const port = await app.startApplicationRepl('with-logger')

  ok(port, 'startApplicationRepl should return a MessagePort')
  ok(typeof port.postMessage === 'function', 'returned port should have postMessage method')
  ok(typeof port.on === 'function', 'returned port should have on method')

  // Collect output
  let output = ''
  port.on('message', (message) => {
    if (message.type === 'output') {
      output += message.data
    }
  })

  // Wait a bit for the REPL to start and send the prompt
  await new Promise(resolve => setTimeout(resolve, 100))

  ok(output.includes('>'), 'REPL should send a prompt')

  // Send a simple expression
  port.postMessage({ type: 'input', data: '1 + 1\n' })

  // Wait for the result
  await new Promise(resolve => setTimeout(resolve, 100))

  ok(output.includes('2'), 'REPL should evaluate expressions and return results')

  // Close the REPL
  port.postMessage({ type: 'close' })
  port.close()
})

test('should have access to app and platformatic in REPL context', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const port = await app.startApplicationRepl('with-logger')

  let output = ''
  port.on('message', (message) => {
    if (message.type === 'output') {
      output += message.data
    }
  })

  // Wait for prompt
  await new Promise(resolve => setTimeout(resolve, 100))

  // Check platformatic is available
  port.postMessage({ type: 'input', data: 'typeof platformatic\n' })
  await new Promise(resolve => setTimeout(resolve, 100))

  ok(output.includes("'object'"), 'platformatic should be available in REPL context')

  // Check config is available
  output = ''
  port.postMessage({ type: 'input', data: 'typeof config\n' })
  await new Promise(resolve => setTimeout(resolve, 100))

  ok(output.includes("'object'"), 'config should be available in REPL context')

  port.postMessage({ type: 'close' })
  port.close()
})

test('should throw error when starting REPL on non-existent service', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  await rejects(
    () => app.startApplicationRepl('non-existent-service'),
    err => {
      ok(err.message.includes('Service not found') || err.message.includes('non-existent-service'))
      return true
    },
    'Should throw error for non-existent service'
  )
})

test('REPL should handle .exit command', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const port = await app.startApplicationRepl('with-logger')

  let exitReceived = false
  port.on('message', (message) => {
    if (message.type === 'exit') {
      exitReceived = true
    }
  })

  // Wait for prompt
  await new Promise(resolve => setTimeout(resolve, 100))

  // Send .exit command
  port.postMessage({ type: 'input', data: '.exit\n' })

  // Wait for exit message
  await new Promise(resolve => setTimeout(resolve, 100))

  ok(exitReceived, 'REPL should send exit message when .exit is entered')
})
