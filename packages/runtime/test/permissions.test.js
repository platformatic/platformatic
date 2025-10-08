import { deepStrictEqual } from 'node:assert'
import { randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime, createTemporaryDirectory } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

async function createContent (t) {
  const root = await createTemporaryDirectory(t, 'permissions')
  const templateFile = join(root, 'template.txt')
  const value = randomBytes(16).toString('hex')
  await writeFile(templateFile, value, 'utf-8')

  const originalEnv = process.env.PLT_TESTS_TEMPLATE_FILE
  const originalPackages = process.env.PLT_TESTS_PACKAGES

  process.env.PLT_TESTS_TEMPLATE_FILE = templateFile
  process.env.PLT_TESTS_PACKAGES = join(import.meta.dirname, '..', '..', '*')
  t.after(() => {
    process.env.PLT_TESTS_TEMPLATE_FILE = originalEnv
    process.env.PLT_TESTS_PACKAGES = originalPackages
  })

  return value
}

test('should access files when access is not restricted', async t => {
  const value = await createContent(t)
  const configFile = join(fixturesDir, 'permissions', 'platformatic.runtime.json')
  const server = await createRuntime(configFile)

  t.after(async () => {
    await server.close()
  })

  const url = await server.start()
  const res = await request(url + '/')

  deepStrictEqual(await res.body.text(), value)
})

test('should access files when access is granted by permissions', async t => {
  const value = await createContent(t)
  const configFile = join(fixturesDir, 'permissions', 'platformatic.allowed.runtime.json')
  const server = await createRuntime(configFile)

  t.after(async () => {
    await server.close()
  })

  const url = await server.start()
  const res = await request(url + '/')

  deepStrictEqual(await res.body.text(), value)
})

test('should not access files when access is not granted by permissions', async t => {
  await createContent(t)
  const configFile = join(fixturesDir, 'permissions', 'platformatic.denied.runtime.json')
  const server = await createRuntime(configFile)

  t.after(async () => {
    await server.close()
  })

  const url = await server.start()
  const res = await request(url + '/')

  deepStrictEqual(await res.body.json(), {
    statusCode: 500,
    code: 'ERR_ACCESS_DENIED',
    error: 'Internal Server Error',
    message: 'Access to this API has been restricted. Use --allow-fs-read to manage permissions.'
  })
})
