import path from 'path'
import { access, rename, cp } from 'fs/promises'
import t from 'tap'
import { execa } from 'execa'
import stripAnsi from 'strip-ansi'
import split from 'split2'
import { cliPath } from './helper.mjs'
import { urlDirname } from '../../lib/utils.js'

t.jobs = 6
t.plan(6)

t.test('should compile typescript plugin', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin')
  const cwd = path.join(urlDirname(import.meta.url), '..', 'tmp', 'typescript-plugin-clone-1')

  await cp(testDir, cwd, { recursive: true })

  try {
    const child = await execa('node', [cliPath, 'compile'], { cwd })
    t.equal(child.stdout.includes('Typescript compilation completed successfully.'), true)
  } catch (err) {
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
    child.kill('SIGINT')
  })

  const splitter = split()
  child.stdout.pipe(splitter)

  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    if (sanitized.includes('Typescript plugin loaded')) {
      t.pass()
      return
    }
  }
  t.fail('should compile typescript plugin with start command')
})

t.test('should not compile bad typescript plugin', async (t) => {
  const cwd = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'bad-typescript-plugin')

  try {
    await execa('node', [cliPath, 'compile'], { cwd })
    t.fail('should not compile bad typescript plugin')
  } catch (err) {
    t.equal(err.stdout.includes('Found 1 error in plugin.ts'), true)
  }

  const jsPluginPath = path.join(cwd, 'dist', 'plugin.js')
  try {
    await access(jsPluginPath)
    t.fail('should not compile bad typescript plugin')
  } catch (err) {
    t.pass(err)
  }
})

t.test('missing tsconfig file', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin')
  const cwd = path.join(urlDirname(import.meta.url), '..', 'tmp', 'typescript-plugin-clone-2')

  await cp(testDir, cwd, { recursive: true })

  const pathToTSConfig = path.join(cwd, 'tsconfig.json')
  const pathToTSConfigBackup = path.join(cwd, 'tsconfig.json.backup')

  await rename(pathToTSConfig, pathToTSConfigBackup)

  try {
    await execa('node', [cliPath, 'compile'], { cwd })
    t.fail('should not compile typescript plugin')
  } catch (err) {
    t.equal(err.stdout.includes('The tsconfig.json file was not found.'), true)
  }

  t.pass()
})

t.test('start command should not compile typescript plugin with errors', async (t) => {
  const cwd = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'bad-typescript-plugin')

  const childProcess = execa('node', [cliPath, 'start'], { cwd })

  t.teardown(() => {
    childProcess.kill('SIGINT')
  })

  try {
    await childProcess
    t.fail('should not compile bad typescript plugin')
  } catch (err) {
    t.equal(err.stdout.includes('Found 1 error'), true)
    childProcess.kill('SIGINT')
  }

  const jsPluginPath = path.join(cwd, 'dist', 'plugin.js')
  try {
    await access(jsPluginPath)
    t.fail('should not compile bad typescript plugin')
  } catch (err) {
    t.pass(err)
  }
})

t.test('should not compile typescript plugin with start without tsconfig', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin')
  const cwd = path.join(urlDirname(import.meta.url), '..', 'tmp', 'typescript-plugin-clone-4')

  await cp(testDir, cwd, { recursive: true })

  const pathToTSConfig = path.join(cwd, 'tsconfig.json')
  const pathToTSConfigBackup = path.join(cwd, 'tsconfig.json.backup')

  await rename(pathToTSConfig, pathToTSConfigBackup)

  try {
    const child = await execa('node', [cliPath, 'start'], { cwd })
    t.teardown(() => child.kill('SIGINT'))
    t.fail('should not compile typescript plugin with start without tsconfig')
  } catch (err) {
    t.equal(err.stdout.includes('The tsconfig.json file was not found.'), true)
  }
})
