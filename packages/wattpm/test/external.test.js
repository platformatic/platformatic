import { safeRemove } from '@platformatic/utils'
import { deepStrictEqual, ok } from 'node:assert'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { fixturesDir, wattpm } from './helper.js'

test('import - should import a URL', async t => {
  const rootDir = await resolve(fixturesDir, 'main')
  const configurationFile = resolve(rootDir, 'watt.json')
  const originalFileContents = await readFile(configurationFile, 'utf-8')

  t.after(() => writeFile(configurationFile, originalFileContents))

  process.chdir(rootDir)
  await wattpm('import', 'http://github.com/foo/bar.git')

  deepStrictEqual(JSON.parse(await readFile(configurationFile, 'utf-8')), {
    ...JSON.parse(originalFileContents),
    web: [
      {
        id: 'bar',
        path: 'web/bar',
        url: 'http://github.com/foo/bar.git'
      }
    ]
  })
})

test('import - should import a GitHub repo via SSH', async t => {
  const rootDir = await resolve(fixturesDir, 'main')
  const configurationFile = resolve(rootDir, 'watt.json')
  const originalFileContents = await readFile(configurationFile, 'utf-8')

  t.after(() => writeFile(configurationFile, originalFileContents))

  await wattpm('import', rootDir, 'foo/bar', '-i', 'id', '-p', 'path')

  deepStrictEqual(JSON.parse(await readFile(configurationFile, 'utf-8')), {
    ...JSON.parse(originalFileContents),
    web: [
      {
        id: 'id',
        path: 'path',
        url: 'git@github.com:foo/bar.git'
      }
    ]
  })
})

test('import - should import a GitHub repo via HTTP', async t => {
  const rootDir = await resolve(fixturesDir, 'main')
  const configurationFile = resolve(rootDir, 'watt.json')
  const originalFileContents = await readFile(configurationFile, 'utf-8')

  t.after(() => writeFile(configurationFile, originalFileContents))

  await wattpm('import', rootDir, 'foo/bar', '-h', '-i', 'id', '-p', 'path')

  deepStrictEqual(JSON.parse(await readFile(configurationFile, 'utf-8')), {
    ...JSON.parse(originalFileContents),
    web: [
      {
        id: 'id',
        path: 'path',
        url: 'https://github.com/foo/bar.git'
      }
    ]
  })
})

test('import - should complain when the URL is missing', async t => {
  const importProcess = await wattpm('import', { reject: false })

  deepStrictEqual(importProcess.exitCode, 1)
  ok(importProcess.stdout.includes('Please specify the resource to import.'))
})

test('resolve - should clone a URL', async t => {
  const rootDir = await resolve(fixturesDir, 'main')
  const configurationFile = resolve(rootDir, 'watt.json')
  const originalFileContents = await readFile(configurationFile, 'utf-8')

  t.after(() => writeFile(configurationFile, originalFileContents))
  t.after(() => safeRemove(resolve(rootDir, 'web/resolved')))

  await wattpm('import', rootDir, '-h', '-i', 'resolved', '-p', 'web/resolved', 'mcollina/undici-thread-interceptor')
  const resolveProcess = await wattpm('resolve', rootDir)

  ok(
    resolveProcess.stdout.includes(
      'Cloning https://github.com/mcollina/undici-thread-interceptor.git into web/resolved'
    )
  )
  ok(resolveProcess.stdout.includes('Installing dependencies ...'))
})

// Note that this test purposely uses gitlab to have a HTTP authentication error, GitHub ignores those parameters
test('resolve - should attempt to clone with username and password', async t => {
  const rootDir = await resolve(fixturesDir, 'main')
  const configurationFile = resolve(rootDir, 'watt.json')
  const originalFileContents = await readFile(configurationFile, 'utf-8')

  t.after(() => writeFile(configurationFile, originalFileContents))
  t.after(() => safeRemove(resolve(rootDir, 'web/resolved')))

  await wattpm(
    'import',
    rootDir,
    '-i',
    'resolved',
    '-p',
    'web/resolved',
    'https://gitlab.com/mcollina/undici-thread-interceptor.git'
  )
  const resolveProcess = await wattpm('resolve', '-u', 'foo', '-p', 'bar', rootDir, { reject: false })

  deepStrictEqual(resolveProcess.exitCode, 1)
  ok(
    resolveProcess.stdout.includes(
      'Cloning https://gitlab.com/mcollina/undici-thread-interceptor.git as user foo into web/resolved'
    )
  )
  ok(resolveProcess.stdout.includes('HTTP Basic: Access denied'))
})
