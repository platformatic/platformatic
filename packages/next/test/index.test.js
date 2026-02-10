import { deepEqual, notStrictEqual, ok, strictEqual, } from 'node:assert'
import {
  afterEach,
  describe,
  test,
} from 'node:test'

import {
  enhanceNextConfig
} from '../index.js'
import { abstractLogger } from '@platformatic/foundation'

const setupGlobal = (additionalSetup = (platformatic) => {}) => {
  const config = {
    cache: {
      adapter: 'redis',
      url: 'redis://localhost:6379',
    },
  }
  const nextVersion = { major: 16 }
  globalThis.platformatic = {
    basePath: '',
    logger: abstractLogger,
    notifyConfig: () => {},
    config,
    nextVersion,
  }
  additionalSetup(globalThis.platformatic)
}

afterEach(() => {
  globalThis.platformatic = undefined
})

const assertIsrCacheHandler = (nextConfig) => {
  notStrictEqual(nextConfig.cacheComponents, true)
  ok(nextConfig.cacheHandler.includes('redis-isr'))
  strictEqual(nextConfig.cacheHandlers, undefined)
}
const assertComponentsCacheHandlers = (nextConfig) => {
  notStrictEqual(nextConfig.cacheComponents, false)
  ok(nextConfig.cacheHandler.includes('null-isr'))
  ok(nextConfig.cacheHandlers.default.includes('redis-components'))
}
const assertNoCacheHandlers = (nextConfig) => {
  strictEqual(nextConfig.cacheHandler, undefined)
  strictEqual(nextConfig.cacheHandlers, undefined)
}

describe('enhanceNextConfig with caching', () => {
  test('adds ISR caching handler', async () => {
    setupGlobal()
    const nextConfig = await enhanceNextConfig({})
    assertIsrCacheHandler(nextConfig)
  })

  test('adds Components caching handlers when nextConfig.cacheComponents is true', async () => {
    setupGlobal()
    const nextConfig = await enhanceNextConfig({
      cacheComponents: true
    })
    assertComponentsCacheHandlers(nextConfig)
  })

  test('adds Components caching handlers when cacheComponents is true', async () => {
    setupGlobal(({ config }) => {
      config.cache.cacheComponents = true
    })
    const nextConfig = await enhanceNextConfig({})
    assertComponentsCacheHandlers(nextConfig)
  })

  test('does not add caching when cache.enabled is false', async () => {
    setupGlobal(({ config }) => {
      config.cache.enabled = false
    })
    const nextConfig = await enhanceNextConfig({})
    assertNoCacheHandlers(nextConfig)
  })

  test('does not override existing cache handler in next.config.js', async () => {
    setupGlobal()
    const nextConfig = await enhanceNextConfig({
      cacheHandler: 'custom-cache-handler'
    })
    strictEqual(nextConfig.cacheHandler, 'custom-cache-handler')
    strictEqual(nextConfig.cacheHandlers, undefined)
  })

  test('does not override existing cache handlers in next.config.js', async () => {
    setupGlobal()
    const nextConfig = await enhanceNextConfig({
      cacheHandlers: { default: 'custom-cache-handler' }
    })
    deepEqual(nextConfig.cacheHandlers, { default: 'custom-cache-handler' })
    strictEqual(nextConfig.cacheHandler, undefined)
  })

  test('does not add components caching when cacheComponents is true but nextConfig.cacheComponents is false', async () => {
    setupGlobal(({ config }) => {
      config.cache.cacheComponents = false
    })
    const nextConfig = await enhanceNextConfig({
      cacheComponents: true
    })
    assertNoCacheHandlers(nextConfig)
  })

  test('does not add components caching when cacheComponents is false but nextConfig.cacheComponents is true', async () => {
    setupGlobal(({ config }) => {
      config.cache.cacheComponents = true
    })
    const nextConfig = await enhanceNextConfig({
      cacheComponents: false
    })
    assertNoCacheHandlers(nextConfig)
  })

  test('does not add components caching when nextVersion is <16', async () => {
    setupGlobal(({ nextVersion }) => {
      nextVersion.major = 15
    })
    const nextConfig = await enhanceNextConfig({
      cacheComponents: true
    })
    assertNoCacheHandlers(nextConfig)
  })

  test('overrides existing cache handler when ignoreNextConfig is true', async () => {
    setupGlobal(({ config }) => {
      config.cache.ignoreNextConfig = true
    })
    const nextConfig = await enhanceNextConfig({
      cacheHandler: 'custom-cache-handler',
      cacheHandlers: { default: 'custom-cache-handler' }
    })
    assertIsrCacheHandler(nextConfig)
  })

  test('overrides existing cache handlers with components cache when ignoreNextConfig is true', async () => {
    setupGlobal(({ config }) => {
      config.cache.ignoreNextConfig = true
      config.cache.cacheComponents = true
    })
    const nextConfig = await enhanceNextConfig({
      cacheHandler: 'custom-cache-handler',
      cacheHandlers: { default: 'custom-cache-handler' }
    })
    assertComponentsCacheHandlers(nextConfig)
  })

  test('prioritizes platformatic config.cache.cacheComponents when ignoreNextConfig=true and conflict exists', async () => {
    setupGlobal(({ config }) => {
      config.cache.ignoreNextConfig = true
      config.cache.cacheComponents = true
    })
    const nextConfig = await enhanceNextConfig({
      cacheComponents: false
    })
    assertComponentsCacheHandlers(nextConfig)
    strictEqual(nextConfig.cacheComponents, true)
  })

  test('prioritizes platformatic config.cache.cacheComponents=false when ignoreNextConfig=true and conflict exists', async () => {
    setupGlobal(({ config }) => {
      config.cache.ignoreNextConfig = true
      config.cache.cacheComponents = false
    })
    const nextConfig = await enhanceNextConfig({
      cacheComponents: true
    })
    assertIsrCacheHandler(nextConfig)
    strictEqual(nextConfig.cacheComponents, false)
  })
})
