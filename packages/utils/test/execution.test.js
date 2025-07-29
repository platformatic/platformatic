import { equal, strictEqual } from 'node:assert'
import test from 'node:test'
import { executeWithTimeout, kTimeout } from '../index.js'

test('executeWithTimeout - should resolve promise before timeout', async () => {
  const promise = Promise.resolve('success')
  const result = await executeWithTimeout(promise, 1000)
  equal(result, 'success')
})

test('executeWithTimeout - should timeout and return default timeout value', async () => {
  const promise = new Promise(resolve => setTimeout(() => resolve('too late'), 500))
  const result = await executeWithTimeout(promise, 100)
  strictEqual(result, kTimeout)
})

test('executeWithTimeout - should timeout and return custom timeout value', async () => {
  const customTimeoutValue = 'custom timeout'
  const promise = new Promise(resolve => setTimeout(() => resolve('too late'), 500))
  const result = await executeWithTimeout(promise, 100, customTimeoutValue)
  equal(result, customTimeoutValue)
})

test('executeWithTimeout - should handle promise rejection', async () => {
  const promise = Promise.reject(new Error('test error'))
  try {
    await executeWithTimeout(promise, 1000)
  } catch (error) {
    equal(error.message, 'test error')
  }
})

test('executeWithTimeout - should abort timeout when promise resolves first', async () => {
  const fastPromise = new Promise(resolve => setTimeout(() => resolve('fast'), 50))
  const result = await executeWithTimeout(fastPromise, 200)
  equal(result, 'fast')
})
