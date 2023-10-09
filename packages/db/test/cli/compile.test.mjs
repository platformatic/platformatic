import os from 'node:os'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { join } from 'node:path'
import { access, cp } from 'node:fs/promises'
import { execa } from 'execa'
import stripAnsi from 'strip-ansi'
import split from 'split2'
import { urlDirname } from '../../lib/utils.js'
import { getConnectionInfo } from '../helper.js'
import { cliPath } from './helper.js'

test('should compile typescript plugin', async (t) => {
  const testDir = join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin')
  const cwd = join(urlDirname(import.meta.url), '..', 'tmp', 'typescript-plugin-clone-1')

  await cp(testDir, cwd, { recursive: true })

  const { connectionInfo, dropTestDB } = await getConnectionInfo()
  t.after(async () => {
    await dropTestDB()
  })

  try {
    const child = await execa('node', [cliPath, 'compile'], {
      cwd,
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    })
    assert.equal(child.stdout.includes('Typescript compilation completed successfully.'), true)
  } catch (err) {
    console.log(err)
    console.log(err.stdout)
    console.log(err.stderr)
    assert.fail(err.stderr)
  }

  const jsPluginPath = join(cwd, 'dist', 'plugin.js')
  try {
    await access(jsPluginPath)
  } catch (err) {
    assert.fail(err)
  }
})

test('should compile typescript plugin with start command', async (t) => {
  const testDir = join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin')
  const cwd = join(urlDirname(import.meta.url), '..', 'tmp', 'typescript-plugin-clone-3')

  await cp(testDir, cwd, { recursive: true })

  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const child = execa('node', [cliPath, 'start'], {
    cwd,
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  t.after(async () => {
    if (os.platform() === 'win32') {
      try {
        await execa('taskkill', ['/pid', child.pid, '/f', '/t'])
      } catch (err) {
        console.error(`Failed to kill process ${child.pid})`)
      }
    } else {
      child.kill('SIGINT')
    }
    await dropTestDB()
  })

  const splitter = split()
  child.stdout.pipe(splitter)
  child.stderr.pipe(process.stderr)

  for await (const data of splitter) {
    console.log(data)
    const sanitized = stripAnsi(data)
    if (sanitized.includes('Typescript plugin loaded')) {
      return
    }
  }
  assert.fail('should compile typescript plugin with start command')
})
