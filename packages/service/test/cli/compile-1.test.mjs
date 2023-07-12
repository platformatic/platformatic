import path from 'path'
import os from 'os'
import { access, rename, cp, rm, mkdir } from 'fs/promises'
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
  const dir = path.join(urlDirname(import.meta.url), '..', 'tmp', `typescript-plugin-clone-${count++}`)
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

t.test('should compile typescript plugin', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin')
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

t.test('should compile typescript plugin even if typescript is `false`', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin-nocompile')
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

t.test('should compile typescript plugin with start command', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

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
  t.fail('should compile typescript plugin with start command')
})

t.test('should not compile bad typescript plugin', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'bad-typescript-plugin')
  const cwd = await getCWD(t)
  await cp(testDir, cwd, { recursive: true })

  try {
    await execa('node', [cliPath, 'compile'], { cwd })
    t.fail('should not compile bad typescript plugin')
  } catch (err) {
    t.comment(err.stdout)
    t.comment(err.stderr)
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
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  const pathToTSConfig = path.join(cwd, 'tsconfig.json')
  const pathToTSConfigBackup = path.join(cwd, 'tsconfig.json.backup')

  await rename(pathToTSConfig, pathToTSConfigBackup)

  try {
    await execa('node', [cliPath, 'compile'], { cwd })
    t.fail('should not compile typescript plugin')
  } catch (err) {
    t.comment(err.stdout)
    t.comment(err.stderr)
    t.equal(err.stdout.includes('No typescript configuration file was found, skipping compilation.'), true)
  }

  t.pass()
})

t.test('start command should not compile typescript plugin with errors', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'bad-typescript-plugin')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  const childProcess = execa('node', [cliPath, 'start'], { cwd })

  t.teardown(exitOnTeardown(childProcess))

  try {
    await childProcess
    t.fail('should not compile bad typescript plugin')
  } catch (err) {
    if (!err.stdout.includes('Found 1 error')) {
      t.comment(err.stdout)
      t.comment(err.stderr)
      console.error(err)
      t.fail('should throw one ts error')
    }
    await safeKill(childProcess)
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
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  const pathToTSConfig = path.join(cwd, 'tsconfig.json')
  const pathToTSConfigBackup = path.join(cwd, 'tsconfig.json.backup')

  await rename(pathToTSConfig, pathToTSConfigBackup)

  try {
    const child = await execa('node', [cliPath, 'start'], { cwd })
    t.teardown(exitOnTeardown(child))
    t.fail('should not compile typescript plugin with start without tsconfig')
  } catch (err) {
    t.comment(err.stdout)
    t.equal(err.stdout.includes('No typescript configuration file was found, skipping compilation.'), true)
  }
})

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

t.test('should not compile bad typescript plugin', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'bad-typescript-plugin')
  const cwd = await getCWD(t)
  await cp(testDir, cwd, { recursive: true })

  try {
    await execa('node', [cliPath, 'compile'], { cwd })
    t.fail('should not compile bad typescript plugin')
  } catch (err) {
    t.comment(err.stdout)
    t.comment(err.stderr)
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
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  const pathToTSConfig = path.join(cwd, 'tsconfig.json')
  const pathToTSConfigBackup = path.join(cwd, 'tsconfig.json.backup')

  await rename(pathToTSConfig, pathToTSConfigBackup)

  try {
    await execa('node', [cliPath, 'compile'], { cwd })
    t.fail('should not compile typescript plugin')
  } catch (err) {
    t.comment(err.stdout)
    t.comment(err.stderr)
    t.equal(err.stdout.includes('No typescript configuration file was found, skipping compilation.'), true)
  }

  t.pass()
})

t.test('start command should not compile typescript plugin with errors', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'bad-typescript-plugin')
  const cwd = await getCWD(t)
  await cp(testDir, cwd, { recursive: true })

  const childProcess = execa('node', [cliPath, 'start'], { cwd })

  t.teardown(exitOnTeardown(childProcess))

  try {
    await childProcess
    t.fail('should not compile bad typescript plugin')
  } catch (err) {
    if (!err.stdout.includes('Found 1 error')) {
      t.comment(err.stdout)
      t.comment(err.stderr)
      console.error(err)
      t.fail('should throw one ts error')
    }
    safeKill(childProcess)
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
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  const pathToTSConfig = path.join(cwd, 'tsconfig.json')
  const pathToTSConfigBackup = path.join(cwd, 'tsconfig.json.backup')

  await rename(pathToTSConfig, pathToTSConfigBackup)

  try {
    const child = await execa('node', [cliPath, 'start'], { cwd })
    t.teardown(exitOnTeardown(child))
    t.fail('should not compile typescript plugin with start without tsconfig')
  } catch (err) {
    t.comment(err.stdout)
    t.equal(err.stdout.includes('No typescript configuration file was found, skipping compilation.'), true)
  }
})
