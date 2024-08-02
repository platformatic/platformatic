import { createDirectory, safeRemove } from '@platformatic/utils'
import { execa } from 'execa'
import assert from 'node:assert'
import { access, cp } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import split from 'split2'
import stripAnsi from 'strip-ansi'
import { fileURLToPath } from 'url'
import { cliPath, safeKill } from './helper.mjs'

process.setMaxListeners(100)

let count = 0

function urlDirname (url) {
  return path.dirname(fileURLToPath(url))
}

async function getCWD (t) {
  const dir = path.join(urlDirname(import.meta.url), '..', 'tmp', `typescript-plugin-clone-2-${count++}`)
  await createDirectory(dir, true)

  t.after(() => safeRemove(dir))

  return dir
}

function exitOnTeardown (child) {
  return async () => {
    await safeKill(child)
  }
}

test('start command should not compile typescript if `typescript` is false', async t => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin-nocompile')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  const child = execa('node', [cliPath, 'start'], { cwd })
  t.after(exitOnTeardown(child))

  const jsPluginPath = path.join(cwd, 'dist', 'plugin.js')
  try {
    await access(jsPluginPath)
    assert.fail("should not have created 'dist/plugin.js'")
  } catch (err) {
    // cannot start because the plugin is not compiled
    assert.strictEqual(err.code, 'ENOENT')
    assert.strictEqual(err.path, jsPluginPath)
  }
})

test('should compile typescript plugin with start command with different cwd', async t => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin')
  const dest = path.join(urlDirname(import.meta.url), '..', 'tmp', `typescript-plugin-clone2-${count++}`)

  await cp(testDir, dest, { recursive: true })

  const child = execa('node', [cliPath, 'start', '-c', path.join(dest, 'platformatic.service.json')])
  t.after(exitOnTeardown(child))

  const splitter = split()
  child.stdout.pipe(splitter)
  child.stderr.pipe(splitter)

  let output = ''

  const timeout = setTimeout(() => {
    console.log(output)
    assert.fail('should compile typescript plugin with start command')
  }, 30000)

  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    output += sanitized
    if (sanitized.includes('Typescript plugin loaded')) {
      clearTimeout(timeout)
      return
    }
  }
  assert.fail('should compile typescript plugin with start command')
})

test('valid tsconfig file inside an inner folder', async t => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  try {
    await execa('node', [cliPath, 'compile'], { cwd, stdio: 'inherit' })
  } catch (err) {
    assert.fail('should not catch any error')
  }
})

test('should compile typescript plugin with start command from a folder', async t => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-autoload')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  const child = execa('node', [cliPath, 'start'], { cwd })
  t.after(exitOnTeardown(child))

  const splitter = split()
  child.stdout.pipe(splitter)
  child.stderr.pipe(splitter)

  let output = ''

  const timeout = setTimeout(() => {
    console.log(output)
    assert.fail('should compile typescript plugin with start command')
  }, 30000)

  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    output += sanitized
    if (sanitized.includes('Typescript plugin loaded')) {
      clearTimeout(timeout)
      return
    }
  }
  assert.fail('should compile typescript plugin with start command')
})

test('should start the service if it was precompiled and typescript is `false`', async t => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin-nocompile')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  await execa('node', [cliPath, 'compile'], { cwd })

  const child = execa('node', [cliPath, 'start'], { cwd })
  t.after(exitOnTeardown(child))

  const splitter = split()
  child.stdout.pipe(splitter)
  child.stderr.pipe(splitter)

  let output = ''

  const timeout = setTimeout(() => {
    console.log(output)
    assert.fail('should start the service if it was precompiled and typescript is `false`')
  }, 30000)

  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    output += sanitized
    if (sanitized.includes('Typescript plugin loaded')) {
      clearTimeout(timeout)
      return
    }
  }
  assert.fail('should load the typescript plugin without compiling it')
})

test('should not start the service if it was not precompiled and typescript is `false`', async t => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin-nocompile')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  const child = execa('node', [cliPath, 'start'], { cwd })
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
    if (sanitized.includes('Unknown file extension ".ts" for')) {
      clearTimeout(timeout)
      return
    }
  }
  assert.fail('should load the typescript plugin without compiling it')
})

test('should compile typescript plugin with string config', async t => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin-string')
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
    assert.fail('should compile typescript plugin with string config')
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

test('should not start the service if it was not precompiled and typescript is `"false"`', async t => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin-nocompile')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  const child = execa('node', [cliPath, 'start'], { cwd })
  t.after(exitOnTeardown(child))

  const splitter = split()
  child.stdout.pipe(splitter)
  child.stderr.pipe(splitter)

  let output = ''

  const timeout = setTimeout(() => {
    console.log(output)
    assert.fail('should not start the service if it was not precompiled and typescript is `"false"`')
  }, 30000)

  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    output += sanitized
    if (sanitized.includes('Unknown file extension ".ts" for')) {
      clearTimeout(timeout)
      return
    }
  }
  assert.fail('should load the typescript plugin without compiling it')
})

test('should compile typescript plugin with start command with custom tsconfig', async t => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin-custom-tsconfig')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  const child = execa('node', [cliPath, 'start'], { cwd })
  t.after(exitOnTeardown(child))

  const splitter = split()
  child.stdout.pipe(splitter)
  child.stderr.pipe(splitter)

  let output = ''

  const timeout = setTimeout(() => {
    console.log(output)
    assert.fail('should compile typescript plugin with start command with custom tsconfig')
  }, 30000)

  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    output += sanitized
    if (sanitized.includes('Typescript plugin loaded')) {
      clearTimeout(timeout)
      return
    }
  }
  assert.fail('should compile typescript plugin with start command')
})

test('should not start the service if it was not precompiled and typescript is `false`', async t => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin-nocompile-enabled')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  const child = execa('node', [cliPath, 'start'], { cwd })
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
    if (sanitized.includes('Unknown file extension ".ts" for')) {
      clearTimeout(timeout)
      return
    }
  }
  assert.fail('should load the typescript plugin without compiling it')
})

test('should start without a tsconfig but with a outDir configuration', async t => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-compiled')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  const child = execa('node', [cliPath, 'start'], { cwd })
  t.after(exitOnTeardown(child))

  const splitter = split()
  child.stdout.pipe(splitter)
  child.stderr.pipe(splitter)

  let output = ''

  const timeout = setTimeout(() => {
    console.log(output)
    assert.fail('should start without a tsconfig but with a outDir configuration')
  }, 30000)

  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    output += sanitized
    if (sanitized.includes('Typescript plugin loaded')) {
      clearTimeout(timeout)
      return
    }
  }
  assert.fail('should compile typescript plugin with start command')
})

test('should compile typescript plugin with start command with custom flags', async t => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin-custom-flags')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  const child = execa('node', [cliPath, 'start'], { cwd })
  t.after(exitOnTeardown(child))

  const splitter = split()
  child.stdout.pipe(splitter)
  child.stderr.pipe(splitter)

  let output = ''

  const timeout = setTimeout(() => {
    console.log(output)
    assert.fail('should compile typescript plugin with start command with custom flags')
  }, 30000)

  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    output += sanitized
    if (sanitized.includes('Typescript plugin loaded')) {
      clearTimeout(timeout)
      return
    }
  }
  assert.fail('should compile typescript plugin with start command')
})
