import { deepmerge as fastifyDeepMerge } from '@fastify/deepmerge'

// This function merges arrays recursively. When the source is shorter than the target, the target value is cloned.
function deepmergeArray (options) {
  const { deepmerge, clone } = options

  return function mergeArray (target, source) {
    const sourceLength = source.length
    const targetLength = Math.max(target.length, source.length)

    const result = new Array(targetLength)
    for (let i = 0; i < targetLength; i++) {
      result[i] = i < sourceLength ? deepmerge(target[i], source[i]) : clone(target[i])
    }

    return result
  }
}

export const deepmerge = fastifyDeepMerge({ all: true, mergeArray: deepmergeArray })

export function isKeyEnabled (key, config) {
  if (config === undefined) return false
  if (typeof config[key] === 'boolean') {
    return config[key]
  }
  if (config[key] === undefined) {
    return false
  }
  return true
}

export function getPrivateSymbol (obj, name) {
  return Object.getOwnPropertySymbols(obj).find(s => s.description === name)
}
