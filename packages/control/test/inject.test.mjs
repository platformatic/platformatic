'use strict'

import { buildServer } from '@platformatic/runtime'
import { safeRemove } from '@platformatic/utils'
import { execa } from 'execa'
import assert, { deepStrictEqual } from 'node:assert'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

const cliPath = join(import.meta.dirname, '..', 'control.js')
const fixturesDir = join(import.meta.dirname, 'fixtures')

test('should inject runtime entrypoint by pid', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  t.after(() => {
    return app.close()
  })

  const child = await execa('node', [cliPath, 'inject', '-p', process.pid, '/'])
  assert.strictEqual(child.exitCode, 0)
  const responseBody = child.stdout
  const response = JSON.parse(responseBody)
  assert.deepStrictEqual(response, {
    message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev'
  })
})

test('should inject runtime service by pid', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  t.after(() => {
    return app.close()
  })
  const child = await execa('node', [cliPath, 'inject', '-p', process.pid, '-s', 'service-1', '/hello'])
  assert.strictEqual(child.exitCode, 0)
  const responseBody = child.stdout
  const response = JSON.parse(responseBody)
  assert.deepStrictEqual(response, {
    runtime: 'runtime-1',
    service: 'service-1'
  })
})

test('should inject runtime service with headers and body', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  t.after(() => {
    return app.close()
  })

  const child = await execa('node', [
    cliPath,
    'inject',
    '-n',
    'runtime-1',
    '-s',
    'service-1',
    '-X',
    'POST',
    '-H',
    'content-type:application/json',
    '-H',
    'foo: bar',
    '-H',
    'bar: baz',
    '-d',
    '{"foo":"bar"}',
    '-i',
    '/mirror'
  ])
  assert.strictEqual(child.exitCode, 0)

  const responseLines = child.stdout.split('\n')
  assert.strictEqual(responseLines[0], 'HTTP/1.1 200')

  let responseBody = ''
  const responseHeaders = {}
  for (let i = 1; i < responseLines.length; i++) {
    if (responseLines[i] === '') {
      responseBody = responseLines.slice(i + 1).join('\n')
      break
    }
    const [name, value] = responseLines[i].split(': ')
    responseHeaders[name] = value
  }
  assert.strictEqual(responseHeaders.foo, 'bar')
  assert.strictEqual(responseHeaders.bar, 'baz')

  const response = JSON.parse(responseBody)
  assert.deepStrictEqual(response, { foo: 'bar' })
})

test('should inject runtime service with output to the file', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)
  const tmpFilePath = join(tmpdir(), 'plt-control-inject-output')

  await app.start()

  t.after(async () => {
    await app.close()
    await safeRemove(tmpFilePath)
  })

  const child = await execa('node', [
    cliPath,
    'inject',
    '-n',
    'runtime-1',
    '-s',
    'service-1',
    '-X',
    'POST',
    '-H',
    'content-type:application/json',
    '-H',
    'foo: bar',
    '-H',
    'bar: baz',
    '-d',
    '{"foo":"bar"}',
    '-i',
    '-o',
    tmpFilePath,
    '/mirror'
  ])
  assert.strictEqual(child.exitCode, 0)
  assert.strictEqual(child.stdout, '')

  const outputFile = await readFile(tmpFilePath, 'utf8')

  const responseLines = outputFile.split('\n')
  assert.strictEqual(responseLines[0], 'HTTP/1.1 200')

  let responseBody = ''
  const responseHeaders = {}
  for (let i = 1; i < responseLines.length; i++) {
    if (responseLines[i] === '') {
      responseBody = responseLines.slice(i + 1).join('\n')
      break
    }
    const [name, value] = responseLines[i].split(': ')
    responseHeaders[name] = value
  }
  assert.strictEqual(responseHeaders.foo, 'bar')
  assert.strictEqual(responseHeaders.bar, 'baz')

  const response = JSON.parse(responseBody)
  assert.deepStrictEqual(response, { foo: 'bar' })
})

test('should inject runtime service with --verbose option', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  t.after(() => {
    return app.close()
  })

  const child = await execa('node', [
    cliPath,
    'inject',
    '-n',
    'runtime-1',
    '-s',
    'service-1',
    '-X',
    'POST',
    '-H',
    'content-type:application/json',
    '-H',
    'foo: bar',
    '-H',
    'bar: baz',
    '-d',
    '{"foo":"bar"}',
    '-v',
    '/mirror'
  ])
  assert.strictEqual(child.exitCode, 0)

  const responseLines = child.stdout.split('\n')
  assert.strictEqual(responseLines[0], '> POST /mirror HTTP/1.1')
  assert.strictEqual(responseLines[1], '> content-type: application/json')
  assert.strictEqual(responseLines[2], '> foo:  bar')
  assert.strictEqual(responseLines[3], '> bar:  baz')
  assert.strictEqual(responseLines[4], '> ')
  assert.strictEqual(responseLines[5], '< HTTP/1.1 200')

  let responseBody = ''
  const responseHeaders = {}
  for (let i = 6; i < responseLines.length; i++) {
    const responseLine = responseLines[i].replace('< ', '')
    if (responseLine === '') {
      responseBody = responseLines.slice(i + 1).join('\n')
      break
    }
    const [name, value] = responseLine.split(': ')
    responseHeaders[name] = value
  }
  assert.strictEqual(responseHeaders.foo, 'bar')
  assert.strictEqual(responseHeaders.bar, 'baz')

  const response = JSON.parse(responseBody)
  assert.deepStrictEqual(response, { foo: 'bar' })
})

test('inject - should use the same shared memory HTTP cache of the runtime', async t => {
  const projectDir = join(fixturesDir, 'runtime-3')

  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  t.after(async () => {
    await safeRemove(resolve(projectDir, '.env'))
    await app.close()
  })

  const child1 = await execa('node', [cliPath, 'inject', '-n', 'runtime-1', '-s', 'service-1', '/time'])
  assert.strictEqual(child1.exitCode, 0)

  const child2 = await execa('node', [cliPath, 'inject', '-n', 'runtime-1', '-s', 'service-1', '/time'])
  assert.strictEqual(child2.exitCode, 0)

  const child3 = await execa('node', [cliPath, 'inject', '-n', 'runtime-1', '-s', 'service-2', '/service-1-time'])
  assert.strictEqual(child3.exitCode, 0)

  deepStrictEqual(child1.stdout, child2.stdout)
  deepStrictEqual(child1.stdout, child3.stdout)
})

test('should throw if runtime is missing', async t => {
  const child = await execa('node', [cliPath, 'inject', '-p', 42])
  assert.strictEqual(child.exitCode, 0)
  assert.strictEqual(child.stdout, 'Runtime not found.')
})
