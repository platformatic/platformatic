import assert from 'node:assert'
import path, { join } from 'node:path'
import { test } from 'node:test'
import { access, cp, rename, rm, mkdir } from 'node:fs/promises'
import { execa } from 'execa'
import stripAnsi from 'strip-ansi'
import split from 'split2'
import { fileURLToPath } from 'url'
import { cliPath, safeKill } from './helper.mjs'

process.setMaxListeners(100)

let count = 0

function urlDirname (url) {
  return path.dirname(fileURLToPath(url))
}

async function getCWD (t) {
  const dir = path.join(urlDirname(import.meta.url), '..', 'tmp', `typescript-plugin-clone-1-${count++}`)
  try {
    await rm(dir, { recursive: true })
  } catch {}

  await mkdir(dir, { recursive: true })
  t.after(async () => {
    try {
      await rm(dir, { recursive: true })
    } catch {}
  })
  return dir
}

function exitOnTeardown (child) {
  return async () => {
    await safeKill(child)
  }
}

test('should not compile bad typescript plugin', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'bad-typescript-plugin')
  const cwd = await getCWD(t)
  await cp(testDir, cwd, { recursive: true })

  try {
    await execa('node', [cliPath, 'compile'], { cwd })
    assert.fail('should not compile bad typescript plugin')
  } catch (err) {
    assert.strictEqual(err.stdout.includes('Found 1 error in plugin.ts'), true)
  }

  const jsPluginPath = path.join(cwd, 'dist', 'plugin.js')
  try {
    await access(jsPluginPath)
    assert.fail('should not compile bad typescript plugin')
  } catch (err) {}
})

test('missing tsconfig file', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  const pathToTSConfig = path.join(cwd, 'tsconfig.json')
  const pathToTSConfigBackup = path.join(cwd, 'tsconfig.json.backup')

  await rename(pathToTSConfig, pathToTSConfigBackup)

  try {
    await execa('node', [cliPath, 'compile'], { cwd })
    assert.fail('should not compile typescript plugin')
  } catch (err) {
    console.log(err.stdout)
    console.log(err.stderr)
    assert.strictEqual(err.stdout.includes('No typescript configuration file was found, skipping compilation.'), true)
  }
})

test('start command should not compile typescript plugin with errors', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'bad-typescript-plugin')
  const cwd = await getCWD(t)
  await cp(testDir, cwd, { recursive: true })

  const childProcess = execa('node', [cliPath, 'start'], { cwd })
  t.after(exitOnTeardown(childProcess))

  try {
    await childProcess
    assert.fail('should not compile bad typescript plugin')
  } catch (err) {
    if (!err.stdout.includes('Found 1 error')) {
      console.log(err.stdout)
      console.log(err.stderr)
      console.error(err)
      assert.fail('should throw one ts error')
    }
    safeKill(childProcess)
  }

  const jsPluginPath = path.join(cwd, 'dist', 'plugin.js')
  try {
    await access(jsPluginPath)
    assert.fail('should not compile bad typescript plugin')
  } catch (err) {}
})

test('should not compile typescript plugin with start without tsconfig', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  const pathToTSConfig = path.join(cwd, 'tsconfig.json')
  const pathToTSConfigBackup = path.join(cwd, 'tsconfig.json.backup')

  await rename(pathToTSConfig, pathToTSConfigBackup)

  try {
    const child = await execa('node', [cliPath, 'start'], { cwd })
    t.after(exitOnTeardown(child))
    assert.fail('should not compile typescript plugin with start without tsconfig')
  } catch (err) {
    console.log(err.stdout)
    assert.strictEqual(err.stdout.includes('No typescript configuration file was found, skipping compilation.'), true)
  }
})

test('should compile ts app with config', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'hello-ts-with-config')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  const child = execa('node', [cliPath, 'compile'], { cwd })
  t.after(exitOnTeardown(child))

  const splitter = split()
  child.stdout.pipe(splitter)
  child.stderr.pipe(splitter)

  let output = ''

  const timeout = setTimeout(() => {
    console.log(output)
    assert.fail('should not start the service if it was not precompiled and typescript is `false`')
  }, 30000)

  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    output += sanitized
    if (sanitized.includes('Typescript compilation completed successfully.')) {
      clearTimeout(timeout)
      const jsPluginPath = path.join(cwd, 'dist', 'plugin.js')
      try {
        await access(jsPluginPath)
      } catch (err) {
        assert.fail(err)
      }
      return
    }
  }

  assert.fail('should compile typescript plugin with a compile command')
})

test('should clean outDir with --clean', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  const child = execa('node', [cliPath, 'compile'], { cwd })
  t.after(exitOnTeardown(child))

  const splitter = split()
  child.stdout.pipe(splitter)
  child.stderr.pipe(splitter)

  let output = ''

  const timeout = setTimeout(() => {
    console.log(output)
    assert.fail('should not start the service if it was not precompiled and typescript is `false`')
  }, 30000)

  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    output += sanitized
    if (sanitized.includes('Typescript compilation completed successfully.')) {
      clearTimeout(timeout)
      const jsPluginPath = path.join(cwd, 'dist', 'plugin.js')
      try {
        await access(jsPluginPath)
      } catch (err) {
        assert.fail(err)
      }
    }
  }
  // rename plugin file and check plugin.js is not there
  await rename(join(cwd, 'plugin.ts'), join(cwd, 'example.ts'))

  const child2 = execa('node', [cliPath, 'compile', '--clean'], { cwd })
  t.after(exitOnTeardown(child2))

  const splitter2 = split()
  child2.stdout.pipe(splitter2)
  child2.stderr.pipe(splitter2)

  let output2 = ''

  const timeout2 = setTimeout(() => {
    console.log(output2)
    assert.fail('should not start the service if it was not precompiled and typescript is `false`')
  }, 30000)

  for await (const data of splitter2) {
    const sanitized = stripAnsi(data)
    output2 += sanitized
    console.log(output2)
    if (sanitized.includes('Typescript compilation completed successfully.')) {
      clearTimeout(timeout2)
      const jsPluginPath = path.join(cwd, 'dist', 'plugin.js')
      const jsExamplePath = path.join(cwd, 'dist', 'example.js')
      try {
        await access(jsExamplePath)
      } catch (err) {
        assert.fail(err)
      }

      try {
        await access(jsPluginPath)
        assert.fail(new Error('plugin.js file should not be in dist directory'))
      } catch (err) {
        assert.equal(err.code, 'ENOENT')
      }
      return
    }
  }
  assert.fail('should clean directory with --clean option')
})
