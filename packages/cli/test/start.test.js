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

  return new Promise((resolve, reject) => {
    try {
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
      child.stdout.on('data', (chunk) => {
        stdout += chunk

        if (/server listening at/i.test(stdout)) {
          resolve()
        }
      })

      child.on('error', reject)
    } catch (err) {
      reject(err)
    }
  })
})
