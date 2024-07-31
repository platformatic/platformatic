'use strict'

import assert from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { execa } from 'execa'
import * as desm from 'desm'
import { startRuntime } from './helper.mjs'

const cliPath = desm.join(import.meta.url, '..', 'control.js')
const fixturesDir = desm.join(import.meta.url, 'fixtures')

test('should stream runtime logs', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile)
  t.after(() => runtime.kill('SIGINT'))

  const child = execa('node', [cliPath, 'logs', '-p', runtime.pid])
  t.after(() => child.kill('SIGINT'))

  const errorTimeout = setTimeout(() => {
    throw new Error('Couldn\'t start server')
  }, 30000)

  return new Promise((resolve) => {
    child.stdout.on('data', (data) => {
      if (data.toString().includes('Server listening at')) {
        clearTimeout(errorTimeout)
        resolve()
      }
    })
  })
})

test('should filter runtime logs by log level', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile)
  t.after(() => runtime.kill('SIGINT'))

  const child = execa(
    'node',
    [
      cliPath, 'logs',
      '-p', runtime.pid,
      '-l', 'debug',
      '--pretty', 'false',
    ]
  )
  t.after(() => child.kill('SIGINT'))

  const errorTimeout = setTimeout(() => {
    throw new Error('Couldn\'t start server')
  }, 30000)

  const receivedServices = new Set()
  const receivedLogLevels = new Set()

  await new Promise((resolve) => {
    let isService1LogsFinished = false
    let isService2LogsFinished = false

    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n')
      for (const line of lines) {
        if (line === '') continue
        try {
          const parsedLog = JSON.parse(line)
          if (parsedLog.name) {
            receivedServices.add(parsedLog.name)
          }
          if (parsedLog.level) {
            receivedLogLevels.add(parsedLog.level)
          }

          if (parsedLog.msg === 'logs finished') {
            if (parsedLog.name === 'service-1') {
              isService1LogsFinished = true
            }
            if (parsedLog.name === 'service-2') {
              isService2LogsFinished = true
            }
            if (
              isService1LogsFinished &&
              isService2LogsFinished
            ) {
              clearTimeout(errorTimeout)
              resolve()
            }
          }
        } catch {}
      }
    })
  })

  assert.strictEqual(receivedServices.size, 2)
  assert.ok(receivedServices.has('service-1'))
  assert.ok(receivedServices.has('service-2'))

  assert.strictEqual(receivedLogLevels.size, 5)
  assert.ok(receivedLogLevels.has(20)) // debug
  assert.ok(receivedLogLevels.has(30)) // info
  assert.ok(receivedLogLevels.has(40)) // warn
  assert.ok(receivedLogLevels.has(50)) // error
  assert.ok(receivedLogLevels.has(60)) // fatal
})

test('should filter runtime logs by service id', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile)
  t.after(() => runtime.kill('SIGINT'))

  const child = execa(
    'node',
    [
      cliPath, 'logs',
      '-p', runtime.pid,
      '-l', 'trace',
      '-s', 'service-2',
      '--pretty', 'false',
    ]
  )
  t.after(() => child.kill('SIGINT'))

  const errorTimeout = setTimeout(() => {
    throw new Error('Couldn\'t start server')
  }, 30000)

  const receivedServices = new Set()
  const receivedLogLevels = new Set()

  await new Promise((resolve) => {
    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n')
      for (const line of lines) {
        if (line === '') continue
        try {
          const parsedLog = JSON.parse(line)
          if (parsedLog.name) {
            receivedServices.add(parsedLog.name)
          }
          if (parsedLog.level) {
            receivedLogLevels.add(parsedLog.level)
          }

          if (parsedLog.msg === 'logs finished') {
            if (parsedLog.name === 'service-2') {
              clearTimeout(errorTimeout)
              resolve()
            }
          }
        } catch {}
      }
    })
  })

  assert.strictEqual(receivedServices.size, 1)
  assert.ok(receivedServices.has('service-2'))

  assert.strictEqual(receivedLogLevels.size, 6)
  assert.ok(receivedLogLevels.has(10)) // trace
  assert.ok(receivedLogLevels.has(20)) // debug
  assert.ok(receivedLogLevels.has(30)) // info
  assert.ok(receivedLogLevels.has(40)) // warn
  assert.ok(receivedLogLevels.has(50)) // error
  assert.ok(receivedLogLevels.has(60)) // fatal
})

test('should throw if runtime is missing', async (t) => {
  const child = await execa('node', [cliPath, 'logs', '-p', 42])
  assert.strictEqual(child.exitCode, 0)
  assert.strictEqual(child.stdout, 'Runtime not found.')
})
