import path from 'path'
import { rm, access, rename } from 'fs/promises'
import { cliPath } from './helper.mjs'
import { test } from 'tap'
import { fileURLToPath } from 'url'
import { execa } from 'execa'
import stripAnsi from 'strip-ansi'
import split from 'split2'

function urlDirname (url) {
  return path.dirname(fileURLToPath(url))
}

test('should compile typescript plugin', async (t) => {
  const cwd = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin')

  t.teardown(async () => {
    await rm(path.join(cwd, 'dist'), { recursive: true, force: true })
  })

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

test('should not compile bad typescript plugin', async (t) => {
  const cwd = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'bad-typescript-plugin')

  t.teardown(async () => {
    await rm(path.join(cwd, 'dist'), { recursive: true, force: true })
  })

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

test('missing tsconfig file', async (t) => {
  const cwd = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin')
  const pathToTSConfig = path.join(cwd, 'tsconfig.json')
  const pathToTSConfigBackup = path.join(cwd, 'tsconfig.json.backup')

  await rename(pathToTSConfig, pathToTSConfigBackup)
  t.teardown(async () => {
    await rename(pathToTSConfigBackup, pathToTSConfig)
  })

  try {
    const child = await execa('node', [cliPath, 'compile'], { cwd })
    t.equal(child.stdout.includes('The tsconfig.json file was not found.'), true)
  } catch (err) {
    console.log(err.stdout)
    console.log(err.stderr)
    t.fail(err.stderr)
  }

  t.pass()
})

test('should compile typescript plugin with start command', async (t) => {
  const cwd = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin')

  t.teardown(async () => {
    await rm(path.join(cwd, 'dist'), { recursive: true, force: true })
  })

  const child = execa('node', [cliPath, 'start'], { cwd })
  t.teardown(() => child.kill('SIGINT'))

  const splitter = split()
  child.stdout.pipe(splitter)

  let found = false
  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    if (sanitized.includes('Typescript plugin loaded')) {
      found = true
      break
    }
  }
  t.equal(found, true)
})

test('start command should not compile typescript plugin with errors', async (t) => {
  const cwd = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'bad-typescript-plugin')

  t.teardown(async () => {
    await rm(path.join(cwd, 'dist'), { recursive: true, force: true })
  })

  try {
    const child = await execa('node', [cliPath, 'start'], { cwd })
    t.teardown(() => child.kill('SIGINT'))
    t.fail('should not compile bad typescript plugin')
  } catch (err) {
    t.equal(err.stdout.includes('Found 1 error'), true)
  }

  const jsPluginPath = path.join(cwd, 'dist', 'plugin.js')
  try {
    await access(jsPluginPath)
    t.fail('should not compile bad typescript plugin')
  } catch (err) {
    t.pass(err)
  }
})

test('should not compile typescript plugin with start without tsconfig', async (t) => {
  const cwd = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin')
  const pathToTSConfig = path.join(cwd, 'tsconfig.json')
  const pathToTSConfigBackup = path.join(cwd, 'tsconfig.json.backup')

  await rename(pathToTSConfig, pathToTSConfigBackup)
  t.teardown(async () => {
    await rename(pathToTSConfigBackup, pathToTSConfig)
  })

  t.teardown(async () => {
    await rm(path.join(cwd, 'dist'), { recursive: true, force: true })
  })

  try {
    const child = await execa('node', [cliPath, 'start'], { cwd })
    t.teardown(() => child.kill('SIGINT'))
    t.fail('should not compile typescript plugin with start without tsconfig')
  } catch (err) {
    t.equal(err.stdout.includes('The tsconfig.json file was not found.'), true)
  }
})
