import { pathToFileURL } from 'node:url'
import { InvalidErrorHandlerError } from './errors.js'

/**
 * Loads the error handler configured via `server.errorHandler`.
 *
 * The value is already resolved to an absolute path (or to the entrypoint of an installed package)
 * by the `resolveModule`/`resolvePath` schema keywords, so here it only has to be imported.
 */
export async function loadErrorHandler (path) {
  const loaded = await import(pathToFileURL(path))
  let handler = typeof loaded.default !== 'undefined' ? loaded.default : loaded

  // Also support `export function errorHandler` and `module.exports = { errorHandler }`.
  if (handler && typeof handler !== 'function' && typeof handler.errorHandler === 'function') {
    handler = handler.errorHandler
  }

  if (typeof handler !== 'function') {
    throw new InvalidErrorHandlerError(path)
  }

  return handler
}
