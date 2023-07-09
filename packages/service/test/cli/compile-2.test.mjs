import path from 'path'
import os from 'os'
import { access, cp, rm, mkdir } from 'fs/promises'
import t from 'tap'
import { execa } from 'execa'
import stripAnsi from 'strip-ansi'
import split from 'split2'
import { cliPath, safeKill } from './helper.mjs'
import { fileURLToPath } from 'url'

let count = 0

if (os.platform() !== 'win32') {
  t.jobs = 5
}
t.setTimeout(360000)

function urlDirname (url) {
  return path.dirname(fileURLToPath(url))
}

async function getCWD (t) {
  const dir = path.join(urlDirname(import.meta.url), '..', 'tmp', `typescript-plugin-clone2-${count++}`)
  try {
    await rm(dir, { recursive: true })
  } catch {}

  await mkdir(dir, { recursive: true })

  t.teardown(async () => {
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

t.test('start command should not compile typescript if `typescript` is false', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin-nocompile')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  const child = execa('node', [cliPath, 'start'], { cwd })
  t.teardown(exitOnTeardown(child))

  const jsPluginPath = path.join(cwd, 'dist', 'plugin.js')
  try {
    await access(jsPluginPath)
    t.fail("should not have created 'dist/plugin.js'")
  } catch (err) {
    // cannot start because the plugin is not compiled
    t.equal(err.code, 'ENOENT')
    t.equal(err.path, jsPluginPath)
    t.pass()
  }
})

t.test('should compile typescript plugin with start command with different cwd', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin')
  const dest = path.join(urlDirname(import.meta.url), '..', 'tmp', `typescript-plugin-clone-${count++}`)

  await cp(testDir, dest, { recursive: true })

  const child = execa('node', [cliPath, 'start', '-c', path.join(dest, 'platformatic.service.json')])

  t.teardown(exitOnTeardown(child))

  const splitter = split()
  child.stdout.pipe(splitter)
  child.stderr.pipe(process.stderr)

  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    if (sanitized.includes('Typescript plugin loaded')) {
      t.pass()
      return
    }
  }
  t.fail('should compile typescript plugin with start command')
})

t.test('valid tsconfig file inside an inner folder', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  try {
    await execa('node', [cliPath, 'compile'], { cwd, stdio: 'inherit' })
  } catch (err) {
    t.fail('should not catch any error')
  }

  t.pass()
})

t.test('should compile typescript plugin with start command from a folder', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-autoload')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  const child = execa('node', [cliPath, 'start'], { cwd })

  t.teardown(exitOnTeardown(child))

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

t.test('should start the service if it was precompiled and typescript is `false`', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin-nocompile')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  await execa('node', [cliPath, 'compile'], { cwd })

  const child = execa('node', [cliPath, 'start'], { cwd })

  const splitter = split()
  child.stdout.pipe(splitter)

  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    if (sanitized.includes('Typescript plugin loaded')) {
      t.pass()
      return
    }
  }
  t.fail('should load the typescript plugin without compiling it')
})

t.test('should not start the service if it was not precompiled and typescript is `false`', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin-nocompile')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  const child = execa('node', [cliPath, 'start'], { cwd })

  const splitter = split()
  child.stdout.pipe(splitter)
  child.stderr.pipe(splitter)

  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    if (sanitized.includes('Unknown file extension ".ts" for')) {
      t.pass()
      return
    }
  }
  t.fail('should load the typescript plugin without compiling it')
})

t.test('should compile typescript plugin with string config', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin-string')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  const child = execa('node', [cliPath, 'compile'], { cwd })

  t.teardown(exitOnTeardown(child))

  const splitter = split()
  child.stdout.pipe(splitter)

  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    if (sanitized.includes('Typescript compilation completed successfully.')) {
      const jsPluginPath = path.join(cwd, 'dist', 'plugin.js')
      try {
        await access(jsPluginPath)
      } catch (err) {
        t.fail(err)
      }

      t.pass()
      return
    }
  }
  t.fail('should compile typescript plugin with a compile command')
})

t.test('should not start the service if it was not precompiled and typescript is `"false"`', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin-nocompile')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  const child = execa('node', [cliPath, 'start'], { cwd })

  const splitter = split()
  child.stdout.pipe(splitter)
  child.stderr.pipe(splitter)

  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    if (sanitized.includes('Unknown file extension ".ts" for')) {
      t.pass()
      return
    }
  }
  t.fail('should load the typescript plugin without compiling it')
})

t.test('should compile typescript plugin with start command with custom tsconfig', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin-custom-tsconfig')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  const child = execa('node', [cliPath, 'start'], { cwd })

  const splitter = split()
  child.stdout.pipe(splitter)
  child.stderr.pipe(splitter)

  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    if (sanitized.includes('Typescript plugin loaded')) {
      t.pass()
      return
    }
  }
  t.fail('should compile typescript plugin with start command')
})

t.test('should not start the service if it was not precompiled and typescript is `false`', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin-nocompile-enabled')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  const child = execa('node', [cliPath, 'start'], { cwd })

  const splitter = split()
  child.stdout.pipe(splitter)
  child.stderr.pipe(splitter)

  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    if (sanitized.includes('Unknown file extension ".ts" for')) {
      t.pass()
      return
    }
  }
  t.fail('should load the typescript plugin without compiling it')
})

t.test('should start without a tsconfig but with a outDir configuration', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-compiled')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  const child = execa('node', [cliPath, 'start'], { cwd })

  const splitter = split()
  child.stdout.pipe(splitter)
  child.stderr.pipe(splitter)

  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    if (sanitized.includes('Typescript plugin loaded')) {
      t.pass()
      return
    }
  }
  t.fail('should compile typescript plugin with start command')
})

t.test('should compile typescript plugin with start command with custom flags', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin-custom-flags')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  const child = execa('node', [cliPath, 'start'], { cwd })

  const splitter = split()
  child.stdout.pipe(splitter)
  child.stderr.pipe(splitter)

  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    if (sanitized.includes('Typescript plugin loaded')) {
      t.pass()
      return
    }
  }
  t.fail('should compile typescript plugin with start command')
})
