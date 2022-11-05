'use strict'

function deepmergeArray (options) {
  const deepmerge = options.deepmerge
  const clone = options.clone
  return function (target, source) {
    let i = 0
    const sl = source.length
    const il = Math.max(target.length, source.length)
    const result = new Array(il)
    for (i = 0; i < il; ++i) {
      if (i < sl) {
        result[i] = deepmerge(target[i], source[i])
        /* c8 ignore next 3 */
      } else {
        result[i] = clone(target[i])
      }
    }
    return result
  }
}

const deepmerge = require('@fastify/deepmerge')({ all: true, mergeArray: deepmergeArray })

module.exports = deepmerge
