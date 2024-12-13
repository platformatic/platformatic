import { safeRemove } from '@platformatic/utils'
import { execa } from 'execa'
import { ok } from 'node:assert'
import { cp, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { cliPath } from './helper.js'

test('should install dependencies of application and its services using npm by default', async t => {
  const rootDir = await mkdtemp(join(tmpdir(), `test-cli-${process.pid}-`))
  await cp(resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/internal-build-and-production/main'), rootDir, {
    recursive: true
  })

  t.after(() => safeRemove(rootDir))

  const child = await execa('node', [cliPath, 'install'], { cwd: rootDir, env: { NO_COLOR: 'true' } })

  ok(child.stdout.includes('Installing dependencies for the application using npm ...'))
  ok(child.stdout.includes('Installing dependencies for the service composer using npm ...'))
  ok(child.stdout.includes('Installing dependencies for the service db using npm ...'))
  ok(child.stdout.includes('Installing dependencies for the service service using npm ...'))
})

test('should install dependencies of application and its services using npm by default', async t => {
  const rootDir = await mkdtemp(join(tmpdir(), `test-cli-${process.pid}-`))
  await cp(resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/internal-build-and-production/main'), rootDir, {
    recursive: true
  })

  t.after(() => safeRemove(rootDir))

  const child = await execa('node', [cliPath, 'install', '-p'], { cwd: rootDir, env: { NO_COLOR: 'true' } })

  ok(child.stdout.includes('Installing production dependencies for the application using npm ...'))
  ok(child.stdout.includes('Installing production dependencies for the service composer using npm ...'))
  ok(child.stdout.includes('Installing production dependencies for the service db using npm ...'))
  ok(child.stdout.includes('Installing production dependencies for the service service using npm ...'))
})

test('should install dependencies of application and its services using a specific package manager', async t => {
  const rootDir = await mkdtemp(join(tmpdir(), `test-cli-${process.pid}-`))
  await cp(resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/internal-build-and-production/main'), rootDir, {
    recursive: true
  })

  t.after(() => safeRemove(rootDir))

  const child = await execa('node', [cliPath, 'install', '-P', 'pnpm'], { cwd: rootDir, env: { NO_COLOR: 'true' } })

  ok(child.stdout.includes('Installing dependencies for the application using pnpm ...'))
  ok(child.stdout.includes('Installing dependencies for the service composer using npm ...'))
  ok(child.stdout.includes('Installing dependencies for the service db using npm ...'))
  ok(child.stdout.includes('Installing dependencies for the service service using npm ...'))
})

test('should install production dependencies only', async t => {
  const rootDir = await mkdtemp(join(tmpdir(), `test-cli-${process.pid}-`))
  await cp(resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/internal-build-and-production/main'), rootDir, {
    recursive: true
  })

  t.after(() => safeRemove(rootDir))

  const child = await execa('node', [cliPath, 'install', '-p', '-P', 'pnpm'], {
    cwd: rootDir,
    env: { NO_COLOR: 'true' }
  })

  ok(child.stdout.includes('Installing production dependencies for the application using pnpm ...'))
  ok(child.stdout.includes('Installing production dependencies for the service composer using npm ...'))
  ok(child.stdout.includes('Installing production dependencies for the service db using npm ...'))
  ok(child.stdout.includes('Installing production dependencies for the service service using npm ...'))
})
