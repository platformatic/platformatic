import jsonPatch from 'fast-json-patch'

// Operations supported in addition to the RFC 6902 ones, which are delegated to fast-json-patch.
// Each one receives the configuration and the operation, and returns the new configuration.
const operations = {
  merge: applyMerge
}

// Applies a list of RFC 6902 JSON Patch operations, extended with the operations above,
// one at a time and in order.
export function applyConfigPatch (config, patch) {
  for (let i = 0; i < patch.length; i++) {
    const operation = patch[i]

    config = Object.hasOwn(operations, operation.op)
      ? operations[operation.op](config, operation)
      : jsonPatch.applyOperation(config, operation, false, true, true, i).newDocument
  }

  return config
}

// Merges the value into the one at the path following RFC 7396 (JSON Merge Patch):
// existing keys are kept, missing objects are created and null removes a key.
function applyMerge (config, { path, value }) {
  // Wrap the value in the path, so that the missing objects along it are created too
  let wrapped = value
  const keys = parsePointer(path)

  for (let i = keys.length - 1; i >= 0; i--) {
    wrapped = { [keys[i]]: wrapped }
  }

  return mergePatch(config, wrapped)
}

function mergePatch (target, patch) {
  if (!isObject(patch)) {
    return patch
  }

  if (!isObject(target)) {
    target = {}
  }

  for (const [key, value] of Object.entries(patch)) {
    if (key === '__proto__') {
      throw new TypeError('Merging into `__proto__` is banned for security reasons.')
    }

    if (value === null) {
      delete target[key]
    } else {
      target[key] = mergePatch(Object.hasOwn(target, key) ? target[key] : undefined, value)
    }
  }

  return target
}

// Parses a RFC 6901 JSON Pointer, rejecting the paths fast-json-patch rejects too
function parsePointer (path) {
  if (path === '') {
    return []
  }

  const keys = path
    .split('/')
    .slice(1)
    .map(key => key.replaceAll('~1', '/').replaceAll('~0', '~'))

  for (let i = 0; i < keys.length; i++) {
    if (keys[i] === '__proto__' || (keys[i] === 'prototype' && keys[i - 1] === 'constructor')) {
      throw new TypeError('Modifying `__proto__` or `constructor/prototype` is banned for security reasons.')
    }
  }

  return keys
}

function isObject (value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
