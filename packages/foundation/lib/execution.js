import { Unpromise } from '@watchable/unpromise'
import { setTimeout as sleep } from 'node:timers/promises'
import { kCanceled, kTimeout } from './symbols.js'

export async function executeWithTimeout (promise, timeout, timeoutValue = kTimeout) {
  const ac = new AbortController()

  return Unpromise.race([promise, sleep(timeout, timeoutValue, { signal: ac.signal, ref: false })]).then(value => {
    ac.abort()
    return value
  })
}

export async function executeInParallel (fn, args, concurrency = 5, throwOnRejections = true, throwAllErrors = false) {
  const { promise, resolve } = Promise.withResolvers()
  const results = new Map()
  let current = 0
  let pending = 0
  let firstError
  let terminated = false

  if (args.length === 0) {
    return []
  }

  function scheduleNext () {
    // While we have capacity and there are still items to process
    while (current < args.length && pending < concurrency) {
      const i = current++
      pending++

      // Perform the async operation
      fn(...args[i])
        .then(result => {
          results.set(i, result)
        })
        .catch(err => {
          results.set(i, err)
          firstError = err
        })
        .finally(() => {
          pending--

          if (terminated) {
            return
          }

          if ((current === args.length && pending === 0) || (firstError && throwOnRejections)) {
            terminated = true
            resolve()
          } else {
            scheduleNext()
          }
        })
    }
  }

  scheduleNext()
  await promise

  const returnedValues = []
  for (let j = 0; j < args.length; j++) {
    returnedValues.push(results.has(j) ? results.get(j) : kCanceled)
  }

  if (firstError && throwOnRejections) {
    throw throwAllErrors ? AggregateError(returnedValues, 'One or more operations failed.') : firstError
  }

  return returnedValues
}
