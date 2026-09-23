import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'
import { parentPort, workerData } from 'node:worker_threads'
import { ensureLoggableError } from '../errors.js'
import { evaluateConfiguration } from './pipeline.js'

/*
  The recorded import list has to survive a failed evaluation, which is exactly when it matters:
  add an import of a helper to a config file, have the helper throw, and there is no valid result
  for the list to ride back on. So the hook streams each resolved path as it records it rather than
  accumulating one to post at the end — which is also what covers termination, where nothing can
  be posted at all.

  The synchronous API is deliberate: module.register's async variant does not intercept require(),
  and a watt.config.js in a "type": "commonjs" package is CJS.
*/
registerHooks({
  resolve (specifier, context, nextResolve) {
    const result = nextResolve(specifier, context)

    if (typeof result?.url === 'string' && result.url.startsWith('file:')) {
      parentPort.postMessage({ type: 'import', path: fileURLToPath(result.url) })
    }

    return result
  }
})

try {
  const { config, classification, resolveCandidates, warnings, mutatedEnvKeys } = await evaluateConfiguration({
    ...workerData,
    // The worker's process.env is the layered view the main process resolved and handed over; it
    // never inherits the loader's.
    env: process.env,
    onWatchFile (path) {
      parentPort.postMessage({ type: 'watch', path })
    }
  })

  parentPort.postMessage({ type: 'result', config, classification, resolveCandidates, warnings, mutatedEnvKeys })
} catch (error) {
  // Errors are posted as plain data rather than as Error instances: structured clone keeps name,
  // message and stack but drops the code, which is the part every caller branches on.
  const { message, code, stack, name } = ensureLoggableError(error)

  parentPort.postMessage({ type: 'error', error: { message, code, stack, name } })
}
