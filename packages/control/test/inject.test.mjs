'use strict'

import assert from 'node:assert'
import { tmpdir } from 'node:os'
import { test } from 'node:test'
import { join } from 'node:path'
import { readFile, rm } from 'node:fs/promises'
import * as desm from 'desm'
import { execa } from 'execa'
import { buildServer } from '@platformatic/runtime'

const cliPath = desm.join(import.meta.url, '..', 'control.js')
const fixturesDir = desm.join(import.meta.url, 'fixtures')

test('should inject runtime entrypoint by pid', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  t.after(() => {
    app.close()
    app.managementApi.close()
  })

  const child = await execa(
    'node',
    [
      cliPath, 'inject',
      '-p', process.pid,
      '/'
    ]
  )
  assert.strictEqual(child.exitCode, 0)
  const responseBody = child.stdout
  const response = JSON.parse(responseBody)
  assert.deepStrictEqual(response, {
    message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev'
  })
})

test('should inject runtime service by pid', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  t.after(() => {
    app.close()
    app.managementApi.close()
  })

  const child = await execa(
    'node',
    [
      cliPath, 'inject',
      '-p', process.pid,
      '-s', 'service-1',
      '/hello'
    ]
  )
  assert.strictEqual(child.exitCode, 0)
  const responseBody = child.stdout
  const response = JSON.parse(responseBody)
  assert.deepStrictEqual(response, {
    service: 'service-1'
  })
})

test('should inject runtime service with headers and body', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  t.after(() => {
    app.close()
    app.managementApi.close()
  })

  const child = await execa(
    'node',
    [
      cliPath, 'inject',
      '-n', 'runtime-1',
      '-s', 'service-1',
      '-X', 'POST',
      '-H', 'content-type:application/json',
      '-H', 'foo: bar',
      '-H', 'bar: baz',
      '-d', '{"foo":"bar"}',
      '-i',
      '/mirror'
    ]
  )
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

test('should inject runtime service with output to the file', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)
  const tmpFilePath = join(tmpdir(), 'plt-control-inject-output')

  await app.start()

  t.after(() => {
    app.close()
    app.managementApi.close()
    rm(tmpFilePath).catch(() => {})
  })

  const child = await execa(
    'node',
    [
      cliPath, 'inject',
      '-n', 'runtime-1',
      '-s', 'service-1',
      '-X', 'POST',
      '-H', 'content-type:application/json',
      '-H', 'foo: bar',
      '-H', 'bar: baz',
      '-d', '{"foo":"bar"}',
      '-i',
      '-o', tmpFilePath,
      '/mirror'
    ]
  )
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

test('should throw if runtime is missing', async (t) => {
  const child = await execa('node', [cliPath, 'inject', '-p', 42])
  assert.strictEqual(child.exitCode, 0)
  assert.strictEqual(child.stdout, 'Runtime not found.')
})

test('should throw if runtime name and pid are missing', async (t) => {
  const child = await execa('node', [cliPath, 'inject'])
  assert.strictEqual(child.exitCode, 0)
  assert.strictEqual(child.stdout, 'Runtime name or PID is required.')
  assert.strictEqual(child.stdout, 'Runtime name or PID is required.')
})
