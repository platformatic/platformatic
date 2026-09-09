import { dirname } from 'node:path'
import { Worker } from 'node:worker_threads'
import { ensureError } from '../errors.js'
import { ConfigurationEvaluationTimeoutError, EvaluationEndedWithoutResultError } from './errors.js'
import { evaluateConfiguration } from './pipeline.js'

export const defaultEvaluationTimeout = 30000

const workerPath = new URL('./eval-worker.js', import.meta.url)

/*
  All configuration is evaluated in short-lived evaluation worker threads — one for the root
  config, then one per per-app config file, run in parallel.

  A throwaway worker rather than a plain import() in the main process because the ESM module cache
  is not invalidatable, so a same-process re-import would silently return stale config on every dev
  reload — and the recorded import list is what lets the watcher cover helper files, not just the
  config file itself. It also isolates env mutation and config crashes and hangs from the loader.

  The workers isolate module caches, environments, crashes and hangs. They are not a sandbox: a
  config file runs with the runtime's privileges, exactly as in v3, where an application's config
  selected a module the worker then imported and executed.
*/
export async function evaluateConfigurationFile ({
  path,
  directory,
  role = 'root',
  applicationId,
  env,
  command,
  mode,
  production,
  schema,
  timeout = defaultEvaluationTimeout,
  onImport,
  onWatchFile
} = {}) {
  const importedFiles = new Set()
  const watchedFiles = new Set()

  const worker = new Worker(workerPath, {
    // Every eval worker is constructed with an explicit env — the computed layered view — never by
    // inheriting the main process's process.env, so a mutated parent environment can never leak in
    // as apparent real-environment keys. No env windows, no apply/restore choreography.
    env: env ?? {},
    workerData: {
      path,
      directory: directory ?? dirname(path),
      role,
      applicationId,
      command,
      mode,
      production,
      schema
    }
  })

  let settle
  const settled = new Promise(resolve => {
    settle = resolve
  })

  let outcome = null
  let timer = null

  worker.on('message', message => {
    switch (message.type) {
      case 'import':
        if (!importedFiles.has(message.path)) {
          importedFiles.add(message.path)
          onImport?.(message.path)
        }
        break
      case 'watch':
        if (!watchedFiles.has(message.path)) {
          watchedFiles.add(message.path)
          onWatchFile?.(message.path)
        }
        break
      case 'result':
        outcome = { ok: true, value: message }
        settle()
        break
      case 'error':
        outcome = { ok: false, error: ensureError(message.error) }
        settle()
        break
    }
  })

  worker.on('error', error => {
    outcome ??= { ok: false, error }
    settle()
  })

  worker.on('exit', code => {
    // A worker that dies without posting anything still has to settle, and with the paths it did
    // report. The deadline does not cover this: a configuration that awaits a promise nothing will
    // ever settle leaves an empty event loop, so Node exits the thread at once rather than hanging
    // — which is the deadlock the timer is too late to see, not a case it handles.
    outcome ??= { ok: false, error: new EvaluationEndedWithoutResultError(path, code) }
    settle()
  })

  if (timeout > 0) {
    // A config that never resolves — an awaited fetch to a dead host, a forgotten promise —
    // terminates the worker and fails the load with a targeted error instead of hanging boot.
    // Streaming is what makes the imports recorded up to this point survive the termination.
    timer = setTimeout(() => {
      outcome ??= { ok: false, error: new ConfigurationEvaluationTimeoutError(path, timeout) }
      worker.terminate()
      settle()
    }, timeout)

    timer.unref?.()
  }

  try {
    await settled
  } finally {
    clearTimeout(timer)
    await worker.terminate()
  }

  const collected = { importedFiles: [...importedFiles], watchedFiles: [...watchedFiles] }

  if (!outcome.ok) {
    // The paths ride back on the failure too: a watcher holding only the last good set is not
    // watching the helper that just threw, so fixing it would trigger no reload and wattpm dev
    // would look hung on a file the user is actively editing.
    Object.assign(outcome.error, collected)
    throw outcome.error
  }

  const { config, classification, resolveCandidates, warnings, mutatedEnvKeys } = outcome.value

  return { config, classification, resolveCandidates, warnings, mutatedEnvKeys, ...collected }
}

function installEnvironment (view) {
  const previous = { ...process.env }

  for (const key of Object.keys(process.env)) {
    delete process.env[key]
  }

  Object.assign(process.env, view)

  return function restore () {
    for (const key of Object.keys(process.env)) {
      delete process.env[key]
    }

    Object.assign(process.env, previous)
  }
}

/*
  Breakpoint debugging gets an explicit escape hatch, since a throwaway thread dies before an
  inspector can attach: with --inspect-brk, evaluation runs in-process and is therefore restricted
  to one config file, precisely because one process has one module cache, in which only a single
  file's env view can be correct. The other files still evaluate in their workers, and cannot be
  contaminated by this one regardless of ordering — the main process constructs each worker with an
  explicit env, and workers never inherit process.env.

  process.env is installed and restored around the call, so the "does not propagate" statement
  stays true in debug mode. The evaluation deadline is not applied: a paused breakpoint session
  must not be killed by the 30 s timer.
*/
export async function evaluateConfigurationInProcess ({ env, ...options } = {}) {
  const restore = installEnvironment(env ?? {})

  try {
    const result = await evaluateConfiguration({ ...options, env: process.env })

    return { ...result, importedFiles: [], watchedFiles: [] }
  } finally {
    restore()
  }
}
