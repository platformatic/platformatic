'use strict'
const { createCache } = require('async-cache-dedupe')

function setupCache (res, opts) {
  const { entities, addEntityHooks } = res
  const cache = createCache(opts)
  for (const entity of Object.values(entities)) {
    const fnName = `${entity.name}Find`
    const originalFn = entity.find

    cache.define(fnName, {
      serialize (query) {
        const serialized = {
          ...query,
          ctx: undefined
        }
        return serialized
      }
    }, async function (query) {
      const res = await originalFn.call(entity, query)
      return res
    })

    addEntityHooks(entity.singularName, {
      find (originalFn, query) {
        if (query.tx) {
          return originalFn(query)
        }
        return cache[fnName](query)
      }
    })
  }
}

module.exports = setupCache
