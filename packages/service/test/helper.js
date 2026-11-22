import { kMetadata } from '@platformatic/foundation'
import { readFileSync } from 'node:fs'
import { setTimeout as wait } from 'node:timers/promises'
import { Agent, setGlobalDispatcher } from 'undici'
import { createTemporaryDirectory } from '../../basic/test/helper.js'
import { loadConfiguration, ServiceCapability } from '../index.js'

const agent = new Agent({
  allowH2: false,
  keepAliveTimeout: 10,
  keepAliveMaxTimeout: 10,
  tls: {
    rejectUnauthorized: false
  }
})

setGlobalDispatcher(agent)

// The file transport flushes asynchronously, so poll for the expected line
// instead of waiting a fixed amount of time
export async function waitForLogLine (file, predicate, { timeoutMs = 30000, intervalMs = 250 } = {}) {
  const start = Date.now()

  while (true) {
    const logs = []
    try {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (line.trim() === '') {
          continue
        }
        try {
          logs.push(JSON.parse(line))
        } catch {
          // The line has been partially written, it will be retried at the next iteration
        }
      }
    } catch {
      // The file has not been created yet
    }

    const found = logs.find(predicate)
    if (found) {
      return found
    }
    if (Date.now() - start > timeoutMs) {
      return undefined
    }
    await wait(intervalMs)
  }
}

export function buildConfig (options) {
  const base = {
    server: {}
  }

  return Object.assign(base, options)
}

export async function createFromConfig (t, options, applicationFactory, creationOptions = {}) {
  const directory = await createTemporaryDirectory(t)
  const context = {
    applicationFactory,
    isStandalone: true,
    isProduction: creationOptions.production
  }

  const config = await loadConfiguration(directory, options, context)

  if (creationOptions.config) {
    Object.assign(config, creationOptions.config)
  }

  const service = new ServiceCapability(config[kMetadata].root, config, context)

  if (!creationOptions.skipInit) {
    await service.init()
  }

  if (!creationOptions.skipCleanup) {
    t.after(() => service.stop())
  }

  return service
}
