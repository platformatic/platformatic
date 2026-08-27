import { deepStrictEqual, ok } from 'node:assert'
import { resolve } from 'node:path'
import { copyCommonApplication, prepareRuntime, startRuntime } from '../../../basic/test/helper.js'
import { keyFor } from '../../lib/caching/valkey-common.js'
import { updateConfigFile } from '../../../runtime/test/helpers.js'

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
  const { runtime, root } = await prepareRuntime({
    t,
    root: resolve(import.meta.dirname, '../fixtures', configuration),
    production,
    port: 0,
    additionalSetup: async (root, config, args) => {
      await copyCommonApplication(root, 'backend')

      await additionalSetup?.(root, config, args)
    }
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

/*
  Through updateConfigFile, which reads and writes whichever dialect the fixture is in. These named
  the v3 file, and a converted application does not have one.
*/
export async function getCacheSettings (root) {
  let cache

  await updateConfigFile(resolve(root, 'services/frontend/platformatic.json'), config => {
    cache = config.cache
  })

  return cache
}

export async function setCacheSettings (root, settings) {
  await updateConfigFile(resolve(root, 'services/frontend/platformatic.json'), config => {
    if (typeof settings === 'function') {
      settings(config.cache)
    } else {
      Object.assign(config.cache, settings)
    }
  })
}

export async function getValkeyUrl (root) {
  return (await getCacheSettings(root)).url
}

export function verifyValkeySequence (actual, expected) {
  actual = actual.filter(c => c[0] !== 'info')

  const values = []

  // Match and then replace Regexp in the expected set
  for (let i = 0; i < expected.length; i++) {
    for (let j = 0; j < expected[i].length; j++) {
      if (expected[i][j] instanceof RegExp) {
        ok(expected[i][j].test(actual[i][j]), `Expected command ${i} to match ${expected[i][j]}, got ${actual[i][j]}`)
      }
    }

    for (let j = 0; j < expected[i].length; j++) {
      if (expected[i][j] instanceof RegExp) {
        expected[i][j] = actual[i][j]
      }
    }

    if (actual[i][0] === 'set') {
      values.push(actual[i][2])
    }
  }

  deepStrictEqual(actual, expected)

  return values
}
