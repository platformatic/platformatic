import assert from 'node:assert'
import { test } from 'node:test'
import { spawn } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Helper function to run CLI with arguments and capture output
function runCLI (args = []) {
  return new Promise((resolve, reject) => {
    const cliPath = join(__dirname, '..', 'cli.js')
    const proc = spawn('node', [cliPath, ...args], {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    const stdout = []
    const stderr = []

    proc.stdout.on('data', (data) => {
      stdout.push(data.toString())
    })

    proc.stderr.on('data', (data) => {
      stderr.push(data.toString())
    })

    proc.on('error', reject)

    proc.on('close', (code) => {
      resolve({
        code,
        stdout: stdout.join(''),
        stderr: stderr.join('')
      })
    })
  })
}

test('CLI should exit with error code for non-existent command', async (t) => {
  const { code } = await runCLI(['nonexistentcommand'])

  // The important part is that a non-existent command exits with error code 1
  assert.strictEqual(code, 1, 'Process should exit with code 1 for non-existent command')
})

test('CLI should show help when no arguments are provided', async (t) => {
  const { code, stdout } = await runCLI([])

  assert.strictEqual(code, 0, 'Process should exit with code 0')
  assert.ok(
    stdout.includes('WattExtra'),
    'Help output should include application name'
  )
})

test('CLI should show help with help command', async (t) => {
  const { code, stdout } = await runCLI(['help'])

  assert.strictEqual(code, 0, 'Process should exit with code 0')
  assert.ok(
    stdout.includes('WattExtra'),
    'Help output should include application name'
  )
})

test('CLI should show version with version command', async (t) => {
  const { code, stdout } = await runCLI(['version'])
  assert.strictEqual(code, 0, 'Process should exit with code 0')
  assert.ok(
    stdout.includes('WattExtra v'),
    'Version output should include version number'
  )
})
