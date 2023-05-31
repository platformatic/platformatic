import { createRequire, isBuiltin } from 'node:module'
import { dirname, isAbsolute, resolve as pathResolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const thisFile = fileURLToPath(import.meta.url)
const isWindows = process.platform === 'win32'
let timestamp = process.hrtime.bigint()
let port

function bustEsmCache () {
  timestamp = process.hrtime.bigint()
}

function clearCjsCache () {
  // This evicts all of the modules from the require() cache.
  // Note: This does not clean up children references to the deleted module.
  // It's likely not a big deal for most cases, but it is a leak. The child
  // references can be cleaned up, but it is expensive and involves walking
  // the entire require() cache. See the DEP0144 documentation for how to do
  // it.
  Object.keys(require.cache).forEach((key) => {
    delete require.cache[key]
  })
}

function isRelativePath (p) {
  // This function is extracted from Node core, so it should work.
  return p.charAt(0) === '.' &&
    /* c8 ignore next 9 */
    (
      p.length === 1 ||
      p.charAt(1) === '/' ||
      (isWindows && p.charAt(1) === '\\') ||
      (p.charAt(1) === '.' && ((
        p.length === 2 ||
        p.charAt(2) === '/') ||
        (isWindows && p.charAt(2) === '\\')))
    )
}

function specifierToPath (specifier, referencingModuleId) {
  // Convert the specifier into an absolute path if possible. If the specifier
  // cannot be converted to a path (for example for a core module), then return
  // null.
  try {
    const url = new URL(specifier)

    if (url.protocol === 'file:') {
      specifier = url.pathname
    } else {
      return null
    }
  } catch {
    // Ignore error.
  }

  if (isBuiltin(specifier)) {
    return null
  }

  if (isAbsolute(specifier)) {
    return specifier
  }

  /* c8 ignore next 3 */
  if (!referencingModuleId) {
    throw new Error(`cannot map '${specifier}' to an absolute path`)
  }

  if (isRelativePath(specifier)) {
    return pathResolve(dirname(fileURLToPath(referencingModuleId)), specifier)
  } else {
    // The specifier is something in node_modules/.
    const req = createRequire(referencingModuleId)

    return req.resolve(specifier)
  }
}

export async function resolve (specifier, context, nextResolve) {
  const path = specifierToPath(specifier, context.parentURL)

  // If the specifier could not be mapped to a file, or the path is this file,
  // then don't do anything.
  if (typeof path !== 'string' || path === thisFile) {
    return nextResolve(specifier, context)
  }

  return nextResolve(`${path}?ts=${timestamp}`, context)
}

export function globalPreload (context) {
  port = context.port
  port.on('message', () => {
    bustEsmCache()
    clearCjsCache()
    port.postMessage('plt:cache-cleared')
  })

  return 'globalThis.LOADER_PORT = port;'
}
