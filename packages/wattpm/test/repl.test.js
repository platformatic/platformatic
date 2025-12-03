import { deepStrictEqual, ok } from 'node:assert'
import { on } from 'node:events'
import { test } from 'node:test'
import split2 from 'split2'
import { prepareRuntime } from '../../basic/test/helper.js'
import { wattpm } from './helper.js'

test('repl - should start a REPL session in the application', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  t.after(() => {
    replProcess.kill('SIGINT')
    startProcess.kill('SIGINT')

    Promise.all([startProcess.catch(() => {}), replProcess.catch(() => {})])
  })

  const startProcess = wattpm('start', rootDir)

  // Wait for the runtime to start
  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    const parsed = JSON.parse(log.toString())

    if (parsed.msg?.startsWith('Platformatic is now listening')) {
      break
    }
  }

  const replProcess = wattpm('repl', 'main')

  // Collect output
  let output = ''
  replProcess.stdout.on('data', (data) => {
    output += data.toString()
  })

  // Wait for the REPL prompt
  await new Promise((resolve) => {
    const check = () => {
      if (output.includes('>')) {
        resolve()
      } else {
        setTimeout(check, 100)
      }
    }
    check()
  })

  // Send a command
  replProcess.stdin.write('1 + 1\n')

  // Wait for the result
  await new Promise((resolve) => {
    const check = () => {
      if (output.includes('2')) {
        resolve()
      } else {
        setTimeout(check, 100)
      }
    }
    check()
  })

  ok(output.includes('2'), 'REPL should evaluate expressions')

  // Exit the REPL
  replProcess.stdin.write('.exit\n')
})

test('repl - should have access to platformatic context', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  t.after(() => {
    replProcess.kill('SIGINT')
    startProcess.kill('SIGINT')

    Promise.all([startProcess.catch(() => {}), replProcess.catch(() => {})])
  })

  const startProcess = wattpm('start', rootDir)

  // Wait for the runtime to start
  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    const parsed = JSON.parse(log.toString())

    if (parsed.msg?.startsWith('Platformatic is now listening')) {
      break
    }
  }

  const replProcess = wattpm('repl', 'main')

  // Collect output
  let output = ''
  replProcess.stdout.on('data', (data) => {
    output += data.toString()
  })

  // Wait for the REPL prompt
  await new Promise((resolve) => {
    const check = () => {
      if (output.includes('>')) {
        resolve()
      } else {
        setTimeout(check, 100)
      }
    }
    check()
  })

  // Check that platformatic is available
  replProcess.stdin.write('typeof platformatic\n')

  // Wait for the result
  await new Promise((resolve) => {
    const check = () => {
      if (output.includes("'object'")) {
        resolve()
      } else {
        setTimeout(check, 100)
      }
    }
    check()
  })

  ok(output.includes("'object'"), 'platformatic should be an object')

  // Exit the REPL
  replProcess.stdin.write('.exit\n')
})

test('repl - should complain when a runtime is not found', async t => {
  const replProcess = await wattpm('repl', 'p-' + Date.now.toString(), { reject: false })

  deepStrictEqual(replProcess.exitCode, 1)
  ok(replProcess.stdout.includes('Cannot find a matching runtime.'))
})
