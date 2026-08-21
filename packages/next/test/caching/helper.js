import { loadConfiguration, saveConfigurationFile } from '@platformatic/foundation'
import { deepStrictEqual, ok } from 'node:assert'
import { cp } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { commonFixturesRoot, prepareRuntime, startRuntime } from '../../../basic/test/helper.js'
import { keyFor } from '../../lib/caching/valkey-common.js'

const VALKEY_SEQUENCE_TIMEOUT = 15000
const VALKEY_SEQUENCE_POLL_INTERVAL = 25

export const base64ValueMatcher = /^[a-z0-9-_]+$/i
export const valkeyUser = 'plt-caching-test'
export const valkeyPrefix = 'plt:test:caching-valkey'

export async function prepareRuntimeWithBackend (
  t,
  configuration,
  production = false,
  pauseAfterCreation = false,
  applicationsToBuild = false,
  additionalSetup = null
) {
  const { runtime, root } = await prepareRuntime(t, configuration, production, null, async (root, config, args) => {
    await cp(resolve(commonFixturesRoot, 'backend-js'), resolve(root, 'services/backend'), {
      recursive: true
    })

    await additionalSetup?.(root, config, args)
  })

  const url = await startRuntime(t, runtime, pauseAfterCreation, applicationsToBuild)

  return { runtime, url, root }
}

export async function cleanupCache (valkey, valkeyUser) {
  const keys = await valkey.keys(keyFor('plt:test:caching-valkey', '*'))

  if (keys.length === 0) {
    return
  }

  await valkey.acl('delUser', valkeyUser)
  return valkey.del(...keys)
}

export async function getCacheSettings (root) {
  const config = await loadConfiguration(resolve(root, 'services/frontend/platformatic.json'), null, {
    skipMetadata: true
  })
  return config.cache
}

export async function setCacheSettings (root, settings) {
  const config = await loadConfiguration(resolve(root, 'services/frontend/platformatic.json'), null, {
    skipMetadata: true
  })

  if (typeof settings === 'function') {
    settings(config.cache)
  } else {
    Object.assign(config.cache, settings)
  }

  await saveConfigurationFile(resolve(root, 'services/frontend/platformatic.json'), config)
}

export async function getValkeyUrl (root) {
  return (await getCacheSettings(root)).url
}

export async function verifyValkeySequence (
  rawActual,
  expected,
  { timeout = VALKEY_SEQUENCE_TIMEOUT, interval = VALKEY_SEQUENCE_POLL_INTERVAL } = {}
) {
  const filterInfo = arr => arr.filter(c => c[0] !== 'info')

  const start = Date.now()
  let actual = filterInfo(rawActual)
  while (actual.length < expected.length && Date.now() - start < timeout) {
    await sleep(interval)
    actual = filterInfo(rawActual)
  }

  const values = []

  // Match and then replace Regexp in the expected set
  for (let i = 0; i < expected.length; i++) {
    for (let j = 0; j < expected[i].length; j++) {
      if (expected[i][j] instanceof RegExp) {
        ok(actual[i] && expected[i][j].test(actual[i][j]), `Expected command ${i} to match ${expected[i][j]}, got ${actual[i]?.[j]}`)
      }
    }

    for (let j = 0; j < expected[i].length; j++) {
      if (expected[i][j] instanceof RegExp) {
        expected[i][j] = actual[i][j]
      }
    }

    if (actual[i] && actual[i][0] === 'set') {
      values.push(actual[i][2])
    }
  }

  deepStrictEqual(actual, expected)

  return values
}
