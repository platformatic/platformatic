'use strict'
import { test } from 'node:test'
import assert from 'node:assert'
import { join } from 'desm'
import { execa } from 'execa'

import { cliPath } from './helper.js'

test('compile typescript', async () => {
  const pathToConfig = join(import.meta.url, './fixtures/typescript/platformatic.db.json')
  await execa('node', [
    cliPath, 'compile',
    '--config', pathToConfig
  ])
})

test('should not compile typescript plugin and exit with exitCode 1', async () => {
  const pathToConfig = join(import.meta.url, './fixtures/bad-typescript-plugin/platformatic.db.json')
  try {
    await execa('node', [
      cliPath, 'compile',
      '--config', pathToConfig
    ])
    assert.fail('should not compile bad typescript plugin')
  } catch (err) {
    if (err.exitCode !== 1) {
      console.log(err.stdout)
      console.log(err.stderr)
      console.error(err)
      assert.fail('should exit with exitCode 1')
    }
  }
})
