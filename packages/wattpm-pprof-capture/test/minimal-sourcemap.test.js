import { test } from 'node:test'
import { Worker } from 'node:worker_threads'
import { resolve } from 'node:path'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

test.before(async () => {
  const serviceDir = resolve(import.meta.dirname, 'fixtures/sourcemap-test/service')
  try {
    await execAsync('npx tsc', { cwd: serviceDir, timeout: 30000 })
  } catch (err) {
    throw new Error(`Failed to build TypeScript service: ${err.message}`)
  }
})

// Test if SourceMapper works in a plain worker thread on Windows
test('minimal SourceMapper test in worker thread', async (t) => {
  await new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./fixtures/minimal-sourcemap-worker.js', import.meta.url))

    const timeout = setTimeout(() => {
      worker.terminate()
      reject(new Error('Worker timed out after 10 seconds'))
    }, 10000)

    worker.on('message', (msg) => {
      clearTimeout(timeout)
      if (msg.success) {
        resolve()
      } else {
        reject(new Error(`Worker reported error: ${msg.error}`))
      }
    })

    worker.on('error', (err) => {
      clearTimeout(timeout)
      reject(new Error(`Worker error: ${err.message}`))
    })

    worker.on('exit', (code) => {
      clearTimeout(timeout)
      if (code !== 0) {
        reject(new Error(`Worker exited with code ${code}`))
      }
    })
  })
})
