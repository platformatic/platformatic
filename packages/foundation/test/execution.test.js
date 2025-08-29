import { equal, rejects, strictEqual } from 'node:assert'
import test from 'node:test'
import { executeInParallel, executeWithTimeout, kCanceled, kTimeout } from '../index.js'

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

test('executeInParallel - should execute all tasks successfully', async () => {
  async function fn (value) {
    return value * 2
  }
  const args = [[1], [2], [3], [4]]
  const results = await executeInParallel(fn, args, 2)
  equal(results.length, 4)
  equal(results[0], 2)
  equal(results[1], 4)
  equal(results[2], 6)
  equal(results[3], 8)
})

test('executeInParallel - should respect concurrency limit', async () => {
  let concurrent = 0
  let maxConcurrent = 0
  async function fn (value) {
    concurrent++
    maxConcurrent = Math.max(maxConcurrent, concurrent)
    await new Promise(resolve => setTimeout(resolve, 10))
    concurrent--
    return value
  }
  const args = [[1], [2], [3], [4], [5]]
  const results = await executeInParallel(fn, args, 2)
  equal(results.length, 5)
  strictEqual(maxConcurrent, 2)
})

test('executeInParallel - should throw first error by default when throwAllErrors is false', async () => {
  async function fn (value) {
    if (value === 3) {
      throw new Error(`Error for ${value}`)
    }

    return value * 2
  }

  const args = [[1], [2], [3], [4]]

  await rejects(
    async () => await executeInParallel(fn, args, 2),
    err => {
      strictEqual(err instanceof Error, true)
      equal(err.message, 'Error for 3')
      return true
    }
  )
})

test('executeInParallel - should handle errors and throw AggregateError when throwAllErrors is true', async () => {
  async function fn (value) {
    if (value === 3) {
      throw new Error(`Error for ${value}`)
    }

    return value * 2
  }

  const args = [[1], [2], [3], [4]]

  await rejects(
    async () => await executeInParallel(fn, args, 2, true, true),
    err => {
      strictEqual(err instanceof AggregateError, true)
      equal(err.message, 'One or more operations failed.')
      equal(err.errors.length, 4)
      equal(err.errors[0], 2)
      equal(err.errors[1], 4)
      strictEqual(err.errors[2] instanceof Error, true)
      equal(err.errors[2].message, 'Error for 3')
      equal(err.errors[3], 8)
      return true
    }
  )
})

test('executeInParallel - should not throw when throwOnRejections is false', async () => {
  async function fn (value) {
    if (value === 3) {
      throw new Error(`Error for ${value}`)
    }

    return value * 2
  }

  const args = [[1], [2], [3], [4]]
  const results = await executeInParallel(fn, args, 2, false)
  equal(results.length, 4)
  equal(results[0], 2)
  equal(results[1], 4)
  strictEqual(results[2] instanceof Error, true)
  equal(results[2].message, 'Error for 3')
  equal(results[3], 8)
})

test('executeInParallel - should terminate early on first error when throwOnRejections is true', async () => {
  let completed = 0
  async function fn (value) {
    if (value === 2) {
      await new Promise(resolve => setTimeout(resolve, 10))
      throw new Error(`Error for ${value}`)
    }
    await new Promise(resolve => setTimeout(resolve, 50))
    completed++
    return value * 2
  }
  const args = [[1], [2], [3], [4]]
  await rejects(
    async () => await executeInParallel(fn, args, 4),
    err => {
      strictEqual(err instanceof Error, true)
      equal(err.message, 'Error for 2')
      return true
    }
  )
  // Should terminate early, so not all tasks complete
  strictEqual(completed < 3, true)
})

test('executeInParallel - should mark unprocessed items as kCanceled when terminated early with throwAllErrors=true', async () => {
  async function fn (value) {
    if (value === 1) {
      throw new Error(`Error for ${value}`)
    }
    await new Promise(resolve => setTimeout(resolve, 100))
    return value * 2
  }
  const args = [[1], [2], [3], [4]]
  await rejects(
    async () => await executeInParallel(fn, args, 1, true, true),
    err => {
      strictEqual(err instanceof AggregateError, true)
      equal(err.errors.length, 4)
      strictEqual(err.errors[0] instanceof Error, true)
      equal(err.errors[1], kCanceled)
      equal(err.errors[2], kCanceled)
      equal(err.errors[3], kCanceled)
      return true
    }
  )
})

test('executeInParallel - should handle empty args array', async () => {
  async function fn (value) {
    return value * 2
  }
  const args = []
  const results = await executeInParallel(fn, args, 2)
  equal(results.length, 0)
})

test('executeInParallel - should handle single item', async () => {
  async function fn (value) {
    return value * 2
  }
  const args = [[5]]
  const results = await executeInParallel(fn, args, 2)
  equal(results.length, 1)
  equal(results[0], 10)
})

test('executeInParallel - should handle concurrency larger than args length', async () => {
  async function fn (value) {
    return value * 2
  }
  const args = [[1], [2]]
  const results = await executeInParallel(fn, args, 10)
  equal(results.length, 2)
  equal(results[0], 2)
  equal(results[1], 4)
})

test('executeInParallel - should handle multiple arguments per function call', async () => {
  async function fn (a, b, c) {
    return a + b + c
  }
  const args = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9]
  ]
  const results = await executeInParallel(fn, args, 2)
  equal(results.length, 3)
  equal(results[0], 6)
  equal(results[1], 15)
  equal(results[2], 24)
})

test('executeInParallel - should preserve result order regardless of completion order', async () => {
  async function fn (value) {
    // Make later items complete faster
    const delay = value === 1 ? 50 : 10
    await new Promise(resolve => setTimeout(resolve, delay))
    return value * 10
  }
  const args = [[1], [2], [3]]
  const results = await executeInParallel(fn, args, 3)
  equal(results.length, 3)
  equal(results[0], 10) // First in args, should be first in results
  equal(results[1], 20)
  equal(results[2], 30)
})

test('executeInParallel - should handle default concurrency', async () => {
  async function fn (value) {
    return value * 2
  }
  const args = [[1], [2], [3]]
  const results = await executeInParallel(fn, args) // No concurrency specified, should default to 5
  equal(results.length, 3)
  equal(results[0], 2)
  equal(results[1], 4)
  equal(results[2], 6)
})

test('executeInParallel - should handle concurrency of 1 (sequential execution)', async () => {
  const executionOrder = []
  async function fn (value) {
    executionOrder.push(`start-${value}`)
    await new Promise(resolve => setTimeout(resolve, 10))
    executionOrder.push(`end-${value}`)
    return value * 2
  }
  const args = [[1], [2], [3]]
  const results = await executeInParallel(fn, args, 1)
  equal(results.length, 3)
  equal(results[0], 2)
  equal(results[1], 4)
  equal(results[2], 6)
  // Should execute sequentially
  equal(executionOrder.indexOf('end-1') < executionOrder.indexOf('start-2'), true)
  equal(executionOrder.indexOf('end-2') < executionOrder.indexOf('start-3'), true)
})

test('executeInParallel - should return results immediately when all tasks fail and throwOnRejections=false', async () => {
  async function fn (value) {
    throw new Error(`Error for ${value}`)
  }
  const args = [[1], [2], [3]]
  const results = await executeInParallel(fn, args, 2, false)
  equal(results.length, 3)
  strictEqual(results[0] instanceof Error, true)
  strictEqual(results[1] instanceof Error, true)
  strictEqual(results[2] instanceof Error, true)
  equal(results[0].message, 'Error for 1')
  equal(results[1].message, 'Error for 2')
  equal(results[2].message, 'Error for 3')
})

test('executeInParallel - should handle mixed success/failure results when throwOnRejections=false', async () => {
  async function fn (value) {
    if (value % 2 === 0) {
      throw new Error(`Error for ${value}`)
    }
    return value * 2
  }
  const args = [[1], [2], [3], [4], [5]]
  const results = await executeInParallel(fn, args, 3, false)
  equal(results.length, 5)
  equal(results[0], 2) // 1 * 2
  strictEqual(results[1] instanceof Error, true) // Error for 2
  equal(results[2], 6) // 3 * 2
  strictEqual(results[3] instanceof Error, true) // Error for 4
  equal(results[4], 10) // 5 * 2
})

test('executeInParallel - should handle early termination with multiple concurrent errors', async () => {
  let startedTasks = 0
  let completedTasks = 0
  async function fn (value) {
    startedTasks++
    if (value <= 2) {
      await new Promise(resolve => setTimeout(resolve, 10))
      throw new Error(`Error for ${value}`)
    }
    await new Promise(resolve => setTimeout(resolve, 50))
    completedTasks++
    return value * 2
  }
  const args = [[1], [2], [3], [4], [5]]
  await rejects(
    async () => await executeInParallel(fn, args, 3),
    err => {
      strictEqual(err instanceof Error, true)
      return true
    }
  )
  // Should start multiple tasks concurrently but terminate early
  strictEqual(startedTasks >= 2, true)
  strictEqual(completedTasks < 3, true)
})

test('executeInParallel - should handle no args with non-zero concurrency', async () => {
  async function fn (value) {
    return value
  }
  const args = []
  const results = await executeInParallel(fn, args, 10)
  equal(results.length, 0)
})

test('executeInParallel - should handle functions that return undefined', async () => {
  async function fn (value) {
    // Explicitly return undefined
    if (value === 1) return undefined
    // Implicit undefined return
    if (value === 2) return
    return value
  }
  const args = [[1], [2], [3]]
  const results = await executeInParallel(fn, args, 2)
  equal(results.length, 3)
  strictEqual(results[0], undefined)
  strictEqual(results[1], undefined)
  equal(results[2], 3)
})

test('executeInParallel - should handle functions that return null', async () => {
  async function fn (value) {
    return value === 2 ? null : value
  }
  const args = [[1], [2], [3]]
  const results = await executeInParallel(fn, args, 2)
  equal(results.length, 3)
  equal(results[0], 1)
  strictEqual(results[1], null)
  equal(results[2], 3)
})

test('executeInParallel - should handle promise rejections mixed with successful results', async () => {
  async function fn (value) {
    if (value === 2) {
      await new Promise(resolve => setTimeout(resolve, 5))
      throw new Error(`Async error for ${value}`)
    }
    if (value === 4) {
      throw new Error(`Sync error for ${value}`)
    }
    return value * 10
  }
  const args = [[1], [2], [3], [4], [5]]
  await rejects(
    async () => await executeInParallel(fn, args, 3),
    err => {
      return err instanceof Error
    }
  )
})

test('executeInParallel - should maintain result order with varying execution times', async () => {
  async function fn (value) {
    const delay = (6 - value) * 10 // Later items finish faster
    await new Promise(resolve => setTimeout(resolve, delay))
    return `result-${value}`
  }
  const args = [[1], [2], [3], [4], [5]]
  const results = await executeInParallel(fn, args, 5)
  equal(results.length, 5)
  equal(results[0], 'result-1')
  equal(results[1], 'result-2')
  equal(results[2], 'result-3')
  equal(results[3], 'result-4')
  equal(results[4], 'result-5')
})

test('executeInParallel - should handle functions that return promises directly', async () => {
  function fn (value) {
    return Promise.resolve(value * 3)
  }
  const args = [[1], [2], [3]]
  const results = await executeInParallel(fn, args, 2)
  equal(results.length, 3)
  equal(results[0], 3)
  equal(results[1], 6)
  equal(results[2], 9)
})

test('executeInParallel - should handle functions that return rejected promises', async () => {
  function fn (value) {
    if (value === 2) {
      return Promise.reject(new Error(`Promise rejection for ${value}`))
    }
    return Promise.resolve(value * 3)
  }
  const args = [[1], [2], [3]]
  await rejects(
    async () => await executeInParallel(fn, args, 2),
    err => {
      strictEqual(err instanceof Error, true)
      equal(err.message, 'Promise rejection for 2')
      return true
    }
  )
})

test('executeInParallel - should handle very large concurrency values', async () => {
  async function fn (value) {
    return value * 2
  }
  const args = [[1], [2], [3]]
  const results = await executeInParallel(fn, args, 1000) // Much larger than args
  equal(results.length, 3)
  equal(results[0], 2)
  equal(results[1], 4)
  equal(results[2], 6)
})

test('executeInParallel - should complete remaining tasks when throwOnRejections=false', async () => {
  let completedTasks = 0
  async function fn (value) {
    if (value === 2) {
      await new Promise(resolve => setTimeout(resolve, 10))
      throw new Error(`Error for ${value}`)
    }
    await new Promise(resolve => setTimeout(resolve, 20))
    completedTasks++
    return value * 2
  }
  const args = [[1], [2], [3], [4]]
  const results = await executeInParallel(fn, args, 2, false)
  equal(results.length, 4)
  equal(results[0], 2)
  strictEqual(results[1] instanceof Error, true)
  equal(results[2], 6)
  equal(results[3], 8)
  // All non-error tasks should complete
  equal(completedTasks, 3)
})

test('executeInParallel - should handle edge case where error happens after all tasks are scheduled', async () => {
  async function fn (value) {
    const delay = value === 3 ? 5 : 20 // Third task fails quickly
    await new Promise(resolve => setTimeout(resolve, delay))
    if (value === 3) {
      throw new Error(`Error for ${value}`)
    }
    return value * 2
  }
  const args = [[1], [2], [3]]
  await rejects(
    async () => await executeInParallel(fn, args, 3), // All tasks start simultaneously
    err => {
      strictEqual(err instanceof Error, true)
      equal(err.message, 'Error for 3')
      return true
    }
  )
})
