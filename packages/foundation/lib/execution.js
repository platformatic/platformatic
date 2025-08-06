import { Unpromise } from '@watchable/unpromise'
import { setTimeout as sleep } from 'node:timers/promises'

export const kTimeout = Symbol('plt.utils.timeout')

export async function executeWithTimeout (promise, timeout, timeoutValue = kTimeout) {
  const ac = new AbortController()

  return Unpromise.race([promise, sleep(timeout, timeoutValue, { signal: ac.signal, ref: false })]).then(value => {
    ac.abort()
    return value
  })
}
