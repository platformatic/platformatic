import { getMemoryInfo } from './metrics.js'

// Memory readings are shared for ttlMs, and concurrent callers share one read.
// The scope (host or cgroup) is detected on the first read and then reused.
export function createMemoryReader ({ read = getMemoryInfo, ttlMs = 1000 } = {}) {
  let scope
  let reading = null
  let readAt = 0
  let pending = null

  return function readMemory () {
    if (reading && Date.now() - readAt < ttlMs) return Promise.resolve(reading)

    pending ??= read({ scope })
      .then(info => {
        scope = info.scope
        reading = info
        readAt = Date.now()
        return info
      })
      .finally(() => {
        pending = null
      })
    return pending
  }
}

// Shared by every caller in the process, so they share one cached reading.
export const readMemory = createMemoryReader()
