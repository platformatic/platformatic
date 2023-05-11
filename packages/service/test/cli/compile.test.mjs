import path from 'path'
import os from 'os'
import { access, rename, cp } from 'fs/promises'
import t from 'tap'
import { execa } from 'execa'
import stripAnsi from 'strip-ansi'
import split from 'split2'
import { cliPath } from './helper.mjs'
import { fileURLToPath } from 'url'

function urlDirname (url) {
  return path.dirname(fileURLToPath(url))
}

function exitOnTeardown (child) {
  return async () => {
    if (os.platform() === 'win32') {
      try {
        await execa('taskkill', ['/pid', child.pid, '/f', '/t'])
      } catch (err) {
        console.error(`Failed to kill process ${child.pid})`)
      }
    } else {
      child.kill('SIGINT')
    }
  }
}

t.test('should compile typescript plugin', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin')
  const cwd = path.join(urlDirname(import.meta.url), '..', 'tmp', 'typescript-plugin-clone-1')

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
  const cwd = path.join(urlDirname(import.meta.url), '..', 'tmp', 'typescript-plugin-clone-2')

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
  const cwd = path.join(urlDirname(import.meta.url), '..', 'tmp', 'typescript-plugin-clone-3')

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
  const cwd = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'bad-typescript-plugin')

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
  const cwd = path.join(urlDirname(import.meta.url), '..', 'tmp', 'typescript-plugin-clone-4')

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
    if (!err.stderr.includes('Found 1 error')) {
      t.comment(err.stdout)
      t.comment(err.stderr)
      t.fail('should throw one ts error')
    }
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
  const cwd = path.join(urlDirname(import.meta.url), '..', 'tmp', 'typescript-plugin-clone-5')

  await cp(testDir, cwd, { recursive: true })

  const pathToTSConfig = path.join(cwd, 'tsconfig.json')
  const pathToTSConfigBackup = path.join(cwd, 'tsconfig.json.backup')

  await rename(pathToTSConfig, pathToTSConfigBackup)

  try {
    const child = await execa('node', [cliPath, 'start'], { cwd })
    t.teardown(() => child.kill('SIGINT'))
    t.fail('should not compile typescript plugin with start without tsconfig')
  } catch (err) {
    t.comment(err.stdout)
    t.equal(err.stdout.includes('The tsconfig.json file was not found.'), true)
  }
})

t.test('start command should not compile typescript if `typescript` is false', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin-nocompile')
  const cwd = path.join(urlDirname(import.meta.url), '..', 'tmp', 'typescript-plugin-clone-6')

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
  const dest = path.join(urlDirname(import.meta.url), '..', 'tmp', 'typescript-plugin-clone-4')

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
  const cwd = path.join(urlDirname(import.meta.url), '..', 'tmp', 'typescript-plugin-clone-7/inner-folder')

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
  const cwd = path.join(urlDirname(import.meta.url), '..', 'tmp', 'typescript-plugin-clone-8')

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
