'use strict'

/**
 * Regression tests for inquirer compatibility.
 *
 * These tests verify that inquirer prompts work correctly.
 * They were added after inquirer v13 introduced breaking changes:
 * - https://github.com/SBoudrias/Inquirer.js/issues/1975 (numeric defaults on input)
 * - https://github.com/SBoudrias/Inquirer.js/issues/1976 (list prompts accepting free text)
 *
 * If these tests fail after an inquirer upgrade, do NOT upgrade inquirer
 * until the issues are fixed upstream.
 *
 * Note: These tests require the Unix `script` command for PTY emulation.
 * On Linux/macOS, install util-linux if the `script` command is not available.
 *
 * Windows: These tests are skipped because Windows does not have a `script`
 * equivalent.
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { spawn, spawnSync } from 'node:child_process'
import { platform } from 'node:os'
import { fileURLToPath } from 'node:url'

const isWindows = platform() === 'win32'
const pkgRoot = fileURLToPath(new URL('../..', import.meta.url))
const fixturesDir = fileURLToPath(new URL('../fixtures', import.meta.url))

function hasScriptCommand () {
  if (isWindows) return false
  try {
    const result = spawnSync('which', ['script'], { encoding: 'utf8' })
    return result.status === 0
  } catch {
    return false
  }
}

async function runWithPty (scriptPath, input) {
  return new Promise((resolve, reject) => {
    const proc = spawn('script', ['-q', '-c', `node ${scriptPath}`, '/dev/null'], {
      cwd: pkgRoot,
      env: { ...process.env, NO_COLOR: 'true' }
    })

    let output = ''

    proc.stdout.on('data', (data) => {
      output += data.toString()
    })

    proc.stderr.on('data', (data) => {
      output += data.toString()
    })

    if (input !== undefined) {
      proc.stdin.write(input)
      proc.stdin.end()
    }

    proc.on('close', (code) => {
      resolve({ code, output })
    })

    proc.on('error', reject)
  })
}

test('inquirer regression tests', { skip: isWindows && 'Windows not supported (see comment in file)' }, async (t) => {
  assert.ok(
    hasScriptCommand(),
    'The `script` command is required to run these tests. Install util-linux package.'
  )

  await t.test('input prompt with numeric default should not throw', async () => {
    const { output } = await runWithPty(`${fixturesDir}/inquirer-numeric-default.js`, '\n')

    assert.ok(
      !output.includes('ERR_INVALID_ARG_TYPE'),
      'Should not throw ERR_INVALID_ARG_TYPE for numeric default'
    )
    assert.ok(
      output.includes('SUCCESS:'),
      'Should complete successfully when pressing Enter'
    )
  })

  await t.test('list prompt should not accept invalid input', async () => {
    const { output } = await runWithPty(`${fixturesDir}/inquirer-list-validation.js`, 'garbage\n')

    assert.ok(
      !output.includes('RESULT:string:garbage'),
      'List prompt should not accept arbitrary text input'
    )
  })
})
