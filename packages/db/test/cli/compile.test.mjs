import path from 'path'
import os from 'os'
import { access, cp } from 'fs/promises'
import t from 'tap'
import { execa } from 'execa'
import stripAnsi from 'strip-ansi'
import split from 'split2'
import { cliPath } from './helper.js'
import { urlDirname } from '../../lib/utils.js'

t.test('should compile typescript plugin', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin')
  const cwd = path.join(urlDirname(import.meta.url), '..', 'tmp', 'typescript-plugin-clone-1')

  await cp(testDir, cwd, { recursive: true })

  try {
    const child = await execa('node', [cliPath, 'compile'], { cwd })
    t.equal(child.stdout.includes('Typescript compilation completed successfully.'), true)
  } catch (err) {
    console.log(err)
    console.log(err.stdout)
    console.log(err.stderr)
    t.fail(err.stderr)
  }

  const jsPluginPath = path.join(cwd, 'dist', 'plugin.js')
  try {
    await access(jsPluginPath)
  } catch (err) {
    t.fail(err)
  }

  t.pass()
})

t.test('should compile typescript plugin with start command', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin')
  const cwd = path.join(urlDirname(import.meta.url), '..', 'tmp', 'typescript-plugin-clone-3')

  await cp(testDir, cwd, { recursive: true })

  const child = execa('node', [cliPath, 'start'], { cwd })

  t.teardown(async () => {
    if (os.platform() === 'win32') {
      try {
        await execa('taskkill', ['/pid', child.pid, '/f', '/t'])
      } catch (err) {
        console.error(`Failed to kill process ${child.pid})`)
      }
    } else {
      child.kill('SIGINT')
    }
  })

  const splitter = split()
  child.stdout.pipe(splitter)
  child.stderr.pipe(process.stderr)

  for await (const data of splitter) {
    console.log(data)
    const sanitized = stripAnsi(data)
    if (sanitized.includes('Typescript plugin loaded')) {
      t.pass()
      return
    }
  }
  t.fail('should compile typescript plugin with start command')
})
