import { createRequire, isBuiltin } from 'node:module'
import { dirname, isAbsolute, resolve as pathResolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import errors from './errors.js'
const isWindows = process.platform === 'win32'
let timestamp = process.hrtime.bigint()
let port

/* c8 ignore next 3 - c8 upgrade marked many existing things as uncovered */
function bustEsmCache () {
  timestamp = process.hrtime.bigint()
}

function isRelativePath (p) {
  // This function is extracted from Node core, so it should work.
  /* c8 ignore next - c8 upgrade marked many existing things as uncovered */
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

function specifierToFileUrl (specifier, referencingModuleId) {
  // Convert the specifier into an absolute path URL if possible. If the
  // specifier cannot be converted to a path (for example for a core module),
  // then return null.
  try {
    const url = new URL(specifier)

    if (url.protocol === 'file:') {
      return url.href
    } else {
      return null
    }
  } catch {
    // Ignore error.
  }

  /* c8 ignore next 3 - c8 upgrade marked many existing things as uncovered */
  if (isBuiltin(specifier)) {
    return null
  }

  /* c8 ignore next 3 */
  if (isAbsolute(specifier)) {
    return pathToFileURL(specifier).href
  }

  /* c8 ignore next 3 */
  if (!referencingModuleId) {
    throw new errors.CannotMapSpecifierToAbsolutePathError(specifier)
  }

  /* c8 ignore next 5 - c8 upgrade marked many existing things as uncovered */
  if (isRelativePath(specifier)) {
    return pathToFileURL(
      pathResolve(dirname(fileURLToPath(referencingModuleId)), specifier)
    ).href
  } else {
    // The specifier is something in node_modules/.
    const req = createRequire(referencingModuleId)

    return pathToFileURL(req.resolve(specifier)).href
  }
}

export async function resolve (specifier, context, nextResolve) {
  const url = specifierToFileUrl(specifier, context.parentURL)

  // If the specifier could not be mapped to a file, or the path is this file,
  // then don't do anything.
  if (typeof url !== 'string' || url === import.meta.url || url.match(/node_modules/)) {
    return nextResolve(specifier, context)
  }

  return nextResolve(`${url}?ts=${timestamp}`, context)
}

export function globalPreload (context) {
  port = context.port
  port.on('message', () => {
    /* c8 ignore next 3 - c8 upgrade marked many existing things as uncovered */
    bustEsmCache()
    port.postMessage('plt:cache-cleared')
  })

  return 'globalThis.LOADER_PORT = port;'
}

export async function initialize (data) {
  port = data.port
  port.on('message', () => {
    bustEsmCache()
    port.postMessage('plt:cache-cleared')
  })
}
