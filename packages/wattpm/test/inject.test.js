import { createDirectory } from '@platformatic/utils'
import { deepStrictEqual, ok } from 'node:assert'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { prepareRuntime } from '../../basic/test/helper.js'
import { createTemporaryDirectory, waitForStart, wattpm } from './helper.js'

test('inject - should send a request to an application', async t => {
  const { root: rootDir } = await prepareRuntime('main', false, 'watt.json')

  const directory = await createTemporaryDirectory(t, 'inject')
  await createDirectory(directory)

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess.stdout)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const entrypointProcess = await wattpm('inject', 'main')

  const serviceProcess = await wattpm(
    '-v',
    'inject',
    'main',
    '-m',
    'POST',
    '-p',
    '/',
    '-h',
    'Content-Type: text/plain',
    '-d',
    'AAAA'
  )

  await writeFile(resolve(directory, 'input.txt'), 'BBBB', 'utf-8')
  await wattpm(
    'inject',
    'main',
    '-f',
    '-o',
    resolve(directory, 'output.txt'),
    '-m',
    'POST',
    '-p',
    '/',
    '-h',
    'Content-Type: text/plain',
    '-D',
    resolve(directory, 'input.txt')
  )

  ok(entrypointProcess.stdout, '{"production":true}')

  ok(serviceProcess.stdout.includes('> POST / HTTP/1.1'))
  ok(serviceProcess.stdout.includes('> Content-Type: text/plain'))
  ok(serviceProcess.stdout.includes('< HTTP/1.1 200'))
  ok(serviceProcess.stdout.includes('< content-type: application/json; charset=utf-8'))
  ok(serviceProcess.stdout.includes('{"body":"AAAA"}'))

  const outputFile = await readFile(resolve(directory, 'output.txt'), 'utf-8')
  ok(outputFile.includes('> POST / HTTP/1.1'))
  ok(outputFile.includes('> Content-Type: text/plain'))
  ok(outputFile.includes('< HTTP/1.1 200'))
  ok(outputFile.includes('< content-type: application/json; charset=utf-8'))
  ok(outputFile.includes('{"body":"BBBB"}'))
})

test('inject - should complain when a runtime is not found', async t => {
  const envProcess = await wattpm('inject', 'p-' + Date.now.toString(), { reject: false })

  deepStrictEqual(envProcess.exitCode, 1)
  ok(envProcess.stdout.includes('Cannot find a matching runtime.'))
})

test('inject - should complain when a service is not found', async t => {
  const { root: rootDir } = await prepareRuntime('main', false, 'watt.json')

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess.stdout)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const envProcess = await wattpm('inject', 'main', 'invalid', { reject: false })

  deepStrictEqual(envProcess.exitCode, 1)
  ok(envProcess.stdout.includes('Cannot find a matching service.'))
})
