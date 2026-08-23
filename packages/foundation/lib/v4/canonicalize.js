import { types } from 'node:util'
import { InvalidConfigValueError } from './errors.js'

export function formatPointer (segments) {
  if (segments.length === 0) {
    return '/'
  }

  return segments.map(segment => `/${String(segment).replace(/~/g, '~0').replace(/\//g, '~1')}`).join('')
}

export function describeValue (value) {
  if (value === null) {
    return 'null'
  }

  if (Array.isArray(value)) {
    return 'array'
  }

  if (typeof value === 'object') {
    const name = value.constructor?.name

    return name && name !== 'Object' ? `${name} instance` : 'object'
  }

  return typeof value
}

export function isPlainObject (value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)

  return prototype === Object.prototype || prototype === null
}

// The two positions where a function survives the walk. The test is structural, not semantic,
// which is why it can run before classification: whatever the file turns out to be, these are the
// only paths a deferred definition can occupy.
export function isDeferredSlot (segments) {
  if (segments.length === 2) {
    return segments[0] === 'application' && segments[1] === 'config'
  }

  if (segments.length === 3) {
    return segments[0] === 'applications' && typeof segments[1] === 'number' && segments[2] === 'config'
  }

  return false
}

/*
  Canonicalization builds a plain-data snapshot rather than inspecting the evaluated object,
  because inspecting is a time-of-check/time-of-use gap: a getter or a Proxy can return one shape
  to the check and another to the clone, so the validated structure and the transported structure
  need not be the same object graph. After this walk nothing else holds a reference to the
  original, which is what makes "nothing downstream ever touches it" literally true.

  structuredClone is not JSON.stringify — it preserves own properties whose value is undefined —
  so omitting them is something this pass does rather than something the boundary does for it.
*/
export function canonicalize (value, { deferred = false } = {}) {
  const slots = []
  const ancestors = new Set()

  function walk (current, segments) {
    const pointer = () => formatPointer(segments)

    if (current === null) {
      return current
    }

    switch (typeof current) {
      case 'string':
      case 'boolean':
        return current
      case 'number':
        if (!Number.isFinite(current)) {
          throw new InvalidConfigValueError(pointer(), `${current} is not a finite number`)
        }

        return current
      case 'bigint':
        throw new InvalidConfigValueError(pointer(), 'bigint values cannot be transported')
      case 'symbol':
        throw new InvalidConfigValueError(pointer(), 'symbol values cannot be transported')
      case 'function':
        if (deferred && isDeferredSlot(segments)) {
          slots.push({ pointer: pointer(), path: segments.slice(), value: current })
          return undefined
        }

        throw new InvalidConfigValueError(
          pointer(),
          'functions cannot be transported; use a file path loaded by the capability instead'
        )
      case 'undefined':
        // Reached only at the root or inside an array: object properties are filtered by the
        // caller below, which is where "omitted" is implemented.
        throw new InvalidConfigValueError(pointer(), 'undefined is not a configuration value')
    }

    if (types.isProxy(current)) {
      throw new InvalidConfigValueError(pointer(), 'Proxies cannot be transported')
    }

    if (ancestors.has(current)) {
      throw new InvalidConfigValueError(pointer(), 'circular references cannot be transported')
    }

    if (Array.isArray(current)) {
      ancestors.add(current)

      const snapshot = current.map((entry, index) => walk(entry, [...segments, index]))

      ancestors.delete(current)
      return snapshot
    }

    if (!isPlainObject(current)) {
      throw new InvalidConfigValueError(pointer(), `${describeValue(current)} values cannot be transported`)
    }

    ancestors.add(current)

    const snapshot = {}
    const descriptors = Object.getOwnPropertyDescriptors(current)

    for (const key of Object.keys(descriptors)) {
      const descriptor = descriptors[key]

      if (!descriptor.enumerable) {
        continue
      }

      const childSegments = [...segments, key]

      // A property that computes on read cannot be transported, and permitting it would make the
      // snapshot unreproducible. Rejected wherever it appears, before it is ever read.
      if (typeof descriptor.get === 'function' || typeof descriptor.set === 'function') {
        throw new InvalidConfigValueError(formatPointer(childSegments), 'accessor properties cannot be transported')
      }

      if (descriptor.value === undefined) {
        // JSON.stringify semantics: the schema's defaults and required rules speak, rather than an
        // error or a silent undefined crossing the boundary.
        continue
      }

      const child = walk(descriptor.value, childSegments)

      if (child === undefined) {
        // A recorded deferred slot. The key stays absent from the snapshot until step 5 splices
        // the resolved value back in.
        continue
      }

      snapshot[key] = child
    }

    ancestors.delete(current)
    return snapshot
  }

  const config = walk(value, [])

  return { config, deferred: slots }
}

// Step 5 splices each resolved definition back into the slot its function occupied.
export function spliceDeferredSlot (config, path, value) {
  let current = config

  for (let i = 0; i < path.length - 1; i++) {
    current = current[path[i]]

    if (current === undefined || current === null) {
      throw new InvalidConfigValueError(formatPointer(path), 'the deferred slot no longer exists in the snapshot')
    }
  }

  current[path[path.length - 1]] = value

  return config
}
