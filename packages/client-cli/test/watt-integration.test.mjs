import * as desm from 'desm'
import { execa } from 'execa'
import { deepStrictEqual, ok } from 'node:assert'
import { existsSync } from 'node:fs'
import { cp, readFile } from 'node:fs/promises'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'path'
import { moveToTmpdir } from './helper.js'

// This test is intentionally redundant to make sure we test all possible situations

test('should create a client for a service inside a Watt runtime', async (t) => {
  const dir = await moveToTmpdir(after)
  const secondDir = join(dir, 'web/second')
  await cp(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'watt'), dir, { recursive: true, })

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), '--name', 'client-1', '--runtime', 'first'], { cwd: secondDir })

  ok(existsSync(join(secondDir, 'client-1/client-1.openapi.json')))
  ok(existsSync(join(secondDir, 'client-1/client-1.d.ts')))
  ok(existsSync(join(secondDir, 'client-1/package.json')))

  const secondJson = JSON.parse(await readFile(join(secondDir, 'watt.json'), 'utf-8'))
  deepStrictEqual(
    secondJson.clients,
    [
      {
        name: 'client1',
        schema: 'client-1/client-1.openapi.json',
        serviceId: 'first',
        type: 'openapi'
      }
    ]
  )
})

test('should create a client for a service inside a Watt runtime and update the requested config file', async (t) => {
  const dir = await moveToTmpdir(after)
  const secondDir = join(dir, 'web/second')
  await cp(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'watt'), dir, { recursive: true, })
  await cp(join(secondDir, 'watt.json'), join(secondDir, '../whatever.json'))

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), '--name', 'client-1', '--runtime', 'first', '--config', '../whatever.json'], { cwd: secondDir })

  ok(existsSync(join(secondDir, 'client-1/client-1.openapi.json')))
  ok(existsSync(join(secondDir, 'client-1/client-1.d.ts')))
  ok(existsSync(join(secondDir, 'client-1/package.json')))

  const secondJson = JSON.parse(await readFile(join(secondDir, 'watt.json'), 'utf-8'))
  deepStrictEqual(secondJson.clients, undefined)

  const whateverJson = JSON.parse(await readFile(join(secondDir, '../whatever.json'), 'utf-8'))
  deepStrictEqual(
    whateverJson.clients,
    [
      {
        name: 'client1',
        schema: 'second/client-1/client-1.openapi.json',
        serviceId: 'first',
        type: 'openapi'
      }
    ]
  )
})

test('should create a standalone client for a service inside a Watt runtime from within the root folder', async (t) => {
  const dir = await moveToTmpdir(after)
  await cp(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'watt'), dir, { recursive: true, })

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), '--name', 'client-1', '--runtime', 'first'], { cwd: dir })

  ok(existsSync(join(dir, 'client-1/client-1.openapi.json')))
  ok(existsSync(join(dir, 'client-1/client-1.cjs')))
  ok(existsSync(join(dir, 'client-1/client-1.d.ts')))
  ok(existsSync(join(dir, 'client-1/package.json')))

  const wattJson = JSON.parse(await readFile(join(dir, 'watt.json'), 'utf-8'))
  deepStrictEqual(wattJson.clients, undefined)

  const firstJson = JSON.parse(await readFile(join(dir, 'web/first/watt.json'), 'utf-8'))
  deepStrictEqual(firstJson.clients, undefined)

  const secondJson = JSON.parse(await readFile(join(dir, 'web/second/watt.json'), 'utf-8'))
  deepStrictEqual(secondJson.clients, undefined)
})

test('should create a standalone client for a service inside a Watt runtime from within the web folder', async (t) => {
  const dir = await moveToTmpdir(after)
  await cp(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'watt'), dir, { recursive: true, })

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), '--name', 'client-1', '--runtime', 'first'], { cwd: join(dir, 'web') })

  ok(existsSync(join(dir, 'web/client-1/client-1.openapi.json')))
  ok(existsSync(join(dir, 'web/client-1/client-1.cjs')))
  ok(existsSync(join(dir, 'web/client-1/client-1.d.ts')))
  ok(existsSync(join(dir, 'web/client-1/package.json')))

  const wattJson = JSON.parse(await readFile(join(dir, 'watt.json'), 'utf-8'))
  deepStrictEqual(wattJson.clients, undefined)

  const firstJson = JSON.parse(await readFile(join(dir, 'web/first/watt.json'), 'utf-8'))
  deepStrictEqual(firstJson.clients, undefined)

  const secondJson = JSON.parse(await readFile(join(dir, 'web/second/watt.json'), 'utf-8'))
  deepStrictEqual(secondJson.clients, undefined)
})

test('should create a frontend client for a service inside a Watt runtime from within the root folder', async (t) => {
  const dir = await moveToTmpdir(after)
  await cp(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'watt'), dir, { recursive: true, })

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), '--name', 'client-1', '--runtime', 'first', '--frontend'], { cwd: dir })

  ok(existsSync(join(dir, 'client-1/client-1.openapi.json')))
  ok(existsSync(join(dir, 'client-1/client-1-types.d.ts')))
  ok(existsSync(join(dir, 'client-1/client-1.mjs')))

  const wattJson = JSON.parse(await readFile(join(dir, 'watt.json'), 'utf-8'))
  deepStrictEqual(wattJson.clients, undefined)
})

test('should create a frontend client for a service inside a Watt runtime from within the web folder', async (t) => {
  const dir = await moveToTmpdir(after)
  await cp(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'watt'), dir, { recursive: true, })

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), '--name', 'client-1', '--runtime', 'first', '--frontend'], { cwd: join(dir, 'web') })

  ok(existsSync(join(dir, 'web/client-1/client-1.openapi.json')))
  ok(existsSync(join(dir, 'web/client-1/client-1-types.d.ts')))
  ok(existsSync(join(dir, 'web/client-1/client-1.mjs')))

  const wattJson = JSON.parse(await readFile(join(dir, 'watt.json'), 'utf-8'))
  deepStrictEqual(wattJson.clients, undefined)
})

test('should create a frontend client for a service inside a Watt runtime from within the service folder', async (t) => {
  const dir = await moveToTmpdir(after)
  const secondDir = join(dir, 'web/second')
  await cp(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'watt'), dir, { recursive: true, })

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), '--name', 'client-1', '--runtime', 'first', '--frontend'], { cwd: secondDir })

  ok(existsSync(join(secondDir, 'client-1/client-1.openapi.json')))
  ok(existsSync(join(secondDir, 'client-1/client-1-types.d.ts')))
  ok(existsSync(join(secondDir, 'client-1/client-1.mjs')))

  const secondJson = JSON.parse(await readFile(join(secondDir, 'watt.json'), 'utf-8'))
  deepStrictEqual(secondJson.clients, undefined)
})
