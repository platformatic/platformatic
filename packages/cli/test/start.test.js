import assert from 'node:assert'
import { spawn } from 'node:child_process'
import { cp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'tap'
import { cliPath } from './helper.js'

let count = 0

test('starts a server', async ({ teardown }) => {
  const src = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'platformatic.service.json')
  const destDir = join(tmpdir(), `test-cli-${process.pid}-${count++}`)
  const dest = join(destDir, 'platformatic.service.json')

  await cp(src, dest)

  const child = spawn(process.execPath, [cliPath, 'start'], {
    cwd: destDir,
    timeout: 10_000
  })

  teardown(async () => {
    try {
      child.kill('SIGINT')
    } catch {} // Ignore error.
  })

  let stdout = ''

  child.stdout.setEncoding('utf8')

  for await (const chunk of child.stdout) {
    stdout += chunk

    if (/server listening at/i.test(stdout)) {
      break
    }
  }
})

test('starts a runtime application', async ({ teardown }) => {
  const srcDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')
  const destDir = join(tmpdir(), `test-cli-${process.pid}-${count++}`)
  let found = false

  await cp(
    join(srcDir, 'platformatic.runtime.json'),
    join(destDir, 'platformatic.runtime.json')
  )
  await cp(
    join(srcDir, 'platformatic.service.json'),
    join(destDir, 'platformatic.service.json')
  )

  const child = spawn(process.execPath, [cliPath, 'start'], {
    cwd: destDir,
    timeout: 10_000
  })

  child.stderr.pipe(process.stderr)

  teardown(async () => {
    try {
      child.kill('SIGKILL')
    } catch {} // Ignore error.
  })

  let stdout = ''

  child.stdout.setEncoding('utf8')

  for await (const chunk of child.stdout) {
    stdout += chunk

    if (/server listening at/i.test(stdout)) {
      found = true
      break
    }
  }

  assert(found)
})
