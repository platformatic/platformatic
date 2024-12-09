'use strict'

const { createRequire } = require('node:module')
const { resolve } = require('node:path')
const { interceptors } = require('undici')
const MemoryCacheStore = require('@platformatic/undici-cache-memory')
const { loadModule } = require('@platformatic/utils')

async function createCacheInterceptor (config, dirname) {
  const projectRequire = createRequire(resolve(dirname, 'index.js'))
  /* c8 ignore next 2 */
  const { store: storeKlass, ...storeConfig } = typeof config === 'object' ? config : {}
  const CacheStore = storeKlass ? await loadModule(projectRequire, storeKlass) : MemoryCacheStore

  return interceptors.cache({
    store: new CacheStore(storeConfig),
    methods: config.methods ?? ['GET', 'HEAD']
  })
}

module.exports = { createCacheInterceptor }
