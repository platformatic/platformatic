import { createDirectory, safeRemove } from '@platformatic/utils'
import { execa } from 'execa'
import { deepStrictEqual, ok } from 'node:assert'
import { spawn } from 'node:child_process'
import { on } from 'node:events'
import { appendFile, cp, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import split2 from 'split2'
import { ensureDependencies } from '../../basic/test/helper.js'
import { prepareGitRepository } from '../../wattpm/test/helper.js'
import { cliPath } from './helper.js'

let count = 0

test('starts a server', async t => {
  const src = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'platformatic.service.json')
  const destDir = join(tmpdir(), `test-cli-${process.pid}-${count++}`)
  const dest = join(destDir, 'platformatic.service.json')

  await cp(src, dest)

  const child = spawn(process.execPath, [cliPath, 'start'], {
    cwd: destDir,
    timeout: 10_000
  })

  t.after(async () => {
    try {
      child.kill('SIGINT')
    } catch {} // Ignore error.
  })

  let stdout = ''

  child.stdout.setEncoding('utf8')

  for await (const chunk of child.stdout) {
    stdout += chunk

    if (/server listening at/i.test(stdout)) {
      break
    }
  }
})

test('starts a runtime application', async t => {
  const srcDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')
  const destDir = join(tmpdir(), `test-cli-${process.pid}-${count++}`)
  let found = false

  await cp(join(srcDir, 'platformatic.runtime.json'), join(destDir, 'platformatic.runtime.json'))
  await cp(join(srcDir, 'platformatic.service.json'), join(destDir, 'platformatic.service.json'))

  await createDirectory(join(destDir, 'node_modules', '@platformatic'))

  await symlink(
    join(srcDir, '..', '..', 'node_modules', '@platformatic', 'service'),
    join(destDir, 'node_modules', '@platformatic', 'service')
  )

  const child = spawn(process.execPath, [cliPath, 'start'], {
    cwd: destDir,
    timeout: 10_000
  })

  child.stderr.pipe(process.stderr)

  t.after(async () => {
    try {
      child.kill('SIGKILL')
    } catch {} // Ignore error.
  })

  let stdout = ''

  child.stdout.setEncoding('utf8')

  for await (const chunk of child.stdout) {
    stdout += chunk

    if (/server listening at/i.test(stdout)) {
      found = true
      break
    }
  }

  ok(found)
})

test('start should use default folders for resolved services', async t => {
  const rootDir = await mkdtemp(join(tmpdir(), `test-cli-${process.pid}-`))
  await cp(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'runtime-resolve-start'), rootDir, {
    recursive: true
  })
  await prepareGitRepository(t, rootDir)
  t.after(() => safeRemove(rootDir))

  await execa('node', [cliPath, 'resolve'], { cwd: rootDir, env: { NO_COLOR: 'true' } })
  await writeFile(
    resolve(rootDir, 'external/resolved/package.json'),
    JSON.stringify({ private: true, dependencies: { '@platformatic/node': '^2.8.0' } }, null, 2),
    'utf-8'
  )
  const child = spawn(process.execPath, [cliPath, 'start'], { cwd: rootDir, timeout: 10_000 })
  await ensureDependencies([resolve(rootDir, 'external/resolved')])

  t.after(async () => {
    try {
      child.kill('SIGKILL')
    } catch {} // Ignore error.
  })

  let started = false
  for await (const log of on(child.stdout.pipe(split2()), 'data')) {
    const parsed = JSON.parse(log.toString())

    if (parsed.msg.startsWith('Started the service "resolved"')) {
      started = true
      break
    }
  }

  ok(started)
})

test('start should throw an error when a service has not been resolved', async t => {
  const rootDir = await mkdtemp(join(tmpdir(), `test-cli-${process.pid}-`))
  await cp(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'runtime-resolve-start'), rootDir, {
    recursive: true
  })

  await appendFile(resolve(rootDir, '.env'), `PLT_GIT_REPO_URL=file://${rootDir}`)
  const startProcess = await execa('node', [cliPath, 'start'], { cwd: rootDir, reject: false })

  deepStrictEqual(startProcess.exitCode, 1)
  ok(
    startProcess.stdout
      .trim()
      .split('\n')
      .find(l => {
        return (
          JSON.parse(l).msg ===
          'The path for service "resolved" does not exist. Please run "platformatic resolve" and try again.'
        )
      }),
    startProcess.stdout
  )
})

test('start should throw an error when a service has no path and it is not resolvable', async t => {
  const destDir = await mkdtemp(join(tmpdir(), `test-cli-${process.pid}-`))
  await createDirectory(destDir)

  await cp(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'runtime-resolve-start'), destDir, {
    recursive: true
  })

  const config = JSON.parse(await readFile(resolve(destDir, 'platformatic.json'), 'utf-8'))
  config.services[0].url = undefined
  await writeFile(resolve(destDir, 'platformatic.json'), JSON.stringify(config, null, 2), 'utf-8')

  const startProcess = await execa('node', [cliPath, 'start'], { cwd: destDir, reject: false })

  deepStrictEqual(startProcess.exitCode, 1)
  ok(
    startProcess.stdout
      .trim()
      .split('\n')
      .find(l => {
        return (
          JSON.parse(l).msg ===
          'The service "resolved" has no path defined. Please check your configuration and try again.'
        )
      }),
    startProcess.stdout
  )
})
