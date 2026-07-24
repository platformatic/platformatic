import { basename } from 'node:path'
import { pathToFileURL } from 'node:url'
import { subscribe, unsubscribe } from 'node:diagnostics_channel'
import { FailedToLoadWorkerExtensionError, InvalidWorkerExtensionError } from '../errors.js'

// Adds a header without clobbering one the application set. writeHead's own
// headers replace same-named ones set earlier, so a header set at request start
// would be lost; the value is appended when the application calls writeHead.
function appendHeader (response, headers, name, value) {
  if (headers) {
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === name.toLowerCase()) {
        const existing = headers[key]
        headers[key] = Array.isArray(existing) ? [...existing, value] : [existing, value]
        return
      }
    }
  }

  const existing = response.getHeader(name)
  if (existing === undefined) {
    response.setHeader(name, value)
  } else {
    response.setHeader(name, Array.isArray(existing) ? [...existing, value] : [existing, value])
  }
}

// Loads and runs an application's worker extensions, wiring the one request
// hook this process owns. Installed at both entrypoint sites: the worker thread
// for in-thread capabilities and the child process for child-process ones,
// because that is where the entrypoint HTTP server actually lives. The caller
// passes its own logger, since the globals logger is not always available where
// this runs (notably the child bootstrap).
export async function installWorkerExtensions (context) {
  const { entrypoint, workerExtensions, logger, ...rest } = context

  let list = workerExtensions
  if (!list) return { async close () {} }
  if (!Array.isArray(list)) list = [list]
  if (list.length === 0) return { async close () {} }

  const handlers = []
  const instances = []

  // A misconfigured extension is logged and skipped rather than thrown: this
  // runs during entrypoint boot, and crashing the worker would only trigger the
  // runtime's bootstrap-retry storm. The application still starts, so the log
  // has to be loud -- it is the only signal that a configured extension is not
  // running.
  function skip (err, path) {
    logger.error(
      { err, extension: path },
      `Worker extension "${path}" failed to load and is DISABLED. The application is running WITHOUT it. Reason: ${err.message}`
    )
  }

  for (const entry of list) {
    const { path, options } = typeof entry === 'string' ? { path: entry } : entry

    let setup
    try {
      setup = (await import(pathToFileURL(path))).default
    } catch (err) {
      skip(new FailedToLoadWorkerExtensionError(path, err.message, { cause: err }), path)
      continue
    }

    if (typeof setup !== 'function') {
      skip(new InvalidWorkerExtensionError(path), path)
      continue
    }

    try {
      const instance = await setup({
        ...rest,
        entrypoint,
        logger: logger.child({ name: `worker-extension:${basename(path)}` }),
        options: options ?? {},
        // Only the entrypoint has a public HTTP server; a hook on a
        // non-entrypoint worker would fire on internal mesh traffic.
        onRequest: entrypoint ? handler => handlers.push(handler) : () => {}
      })
      instances.push({ path, instance })
    } catch (err) {
      skip(new FailedToLoadWorkerExtensionError(path, err.message, { cause: err }), path)
    }
  }

  let onStart
  if (entrypoint && handlers.length > 0) {
    onStart = ({ request, response }) => {
      const pending = []
      const addResponseHeader = (name, value) => pending.push([name, value])

      for (const handler of handlers) {
        try {
          handler({ request, addResponseHeader })
        } catch (err) {
          logger.error({ err }, 'A worker extension request handler threw')
        }
      }

      if (pending.length === 0) return

      // Append when the application writes its headers, not now, so a header the
      // application sets itself is not replaced.
      const originWriteHead = response.writeHead
      response.writeHead = function (statusCode, statusMessage, headers) {
        if (headers === undefined && typeof statusMessage === 'object' && statusMessage !== null) {
          headers = statusMessage
          statusMessage = undefined
        }
        for (const [name, value] of pending) {
          appendHeader(this, headers, name, value)
        }
        return originWriteHead.call(this, statusCode, statusMessage, headers)
      }
    }

    subscribe('http.server.request.start', onStart)
  }

  return {
    async close () {
      if (onStart) unsubscribe('http.server.request.start', onStart)
      // Reverse order: later extensions may depend on earlier ones.
      for (const { path, instance } of instances.reverse()) {
        try {
          await instance?.close?.()
        } catch (err) {
          logger.error({ err }, `Failed to close the worker extension "${path}".`)
        }
      }
    }
  }
}
