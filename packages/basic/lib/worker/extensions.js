import { getLogger } from '@platformatic/globals'
import { subscribe, unsubscribe } from 'node:diagnostics_channel'
import { basename } from 'node:path'
import { pathToFileURL } from 'node:url'
import { FailedToLoadWorkerExtensionError, InvalidWorkerExtensionError } from '../errors.js'

// Loads and runs an application's worker extensions. This is a general
// mechanism: it runs the extension's code in the process that serves the
// entrypoint, hands it a context and a close lifecycle, and does nothing
// HTTP-specific. An extension that wants to observe or alter requests uses
// onEntrypointRequest (below) itself.
//
// Only ever called for the entrypoint application (both call sites gate on it),
// which is the only one that serves external requests. Installed at both
// entrypoint sites: the worker thread for in-thread capabilities and the child
// process for child-process ones, because that is where the entrypoint HTTP
// server actually lives. The caller passes its own logger, since the globals
// logger is not always available where this runs (notably the child bootstrap).
export async function installWorkerExtensions (context) {
  const { workerExtensions, logger, ...rest } = context

  let list = workerExtensions
  if (!list) return { async close () {} }
  if (!Array.isArray(list)) list = [list]
  if (list.length === 0) return { async close () {} }

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

    let module
    try {
      module = await import(pathToFileURL(path))
    } catch (err) {
      skip(new FailedToLoadWorkerExtensionError(path, err.message, { cause: err }), path)
      continue
    }

    // Either a default export or a named `setup` export is accepted. Prefer the
    // default only when it is a function, so a module that default-exports
    // something else but has a valid named `setup` is still honored.
    const setup = typeof module.default === 'function' ? module.default : module.setup
    if (typeof setup !== 'function') {
      skip(new InvalidWorkerExtensionError(path), path)
      continue
    }

    try {
      const instance = await setup({
        ...rest,
        logger: logger.child({ name: `worker-extension:${basename(path)}` }),
        options: options ?? {}
      })
      instances.push({ path, instance })
    } catch (err) {
      skip(new FailedToLoadWorkerExtensionError(path, err.message, { cause: err }), path)
    }
  }

  return {
    async close () {
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

function reportHandlerError (err) {
  const logger = getLogger({ throwOnMissing: false }) ?? console
  logger.error({ err }, 'A worker extension request handler failed and was ignored.')
}

// Optional helper for a worker extension that wants to observe the entrypoint's
// requests or add response headers. Call it from a worker extension's setup;
// the extension is installed before the runtime reports the application ready,
// so the handler is in place before the entrypoint serves traffic. handler
// receives { request, addResponseHeader }: addResponseHeader appends when the
// application flushes its own headers, so a header the application sets is
// preserved rather than replaced. Returns a function that removes the hook;
// wire it into the extension's close.
export function onEntrypointRequest (handler) {
  const onStart = ({ request, response }) => {
    const pending = []
    const addResponseHeader = (name, value) => pending.push([name, value])

    // Isolate the handler: this runs inside a diagnostics_channel subscriber, so
    // an unhandled failure would surface as an uncaughtException and take down
    // the entrypoint process. A buggy handler must only lose its request. The
    // handler is meant to be synchronous, but TypeScript allows an async one
    // where void is expected, so a returned promise is caught too.
    try {
      const result = handler({ request, addResponseHeader })
      if (result && typeof result.then === 'function') {
        result.then(undefined, reportHandlerError)
      }
    } catch (err) {
      reportHandlerError(err)
      return
    }

    if (pending.length === 0) return

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
  return () => unsubscribe('http.server.request.start', onStart)
}
