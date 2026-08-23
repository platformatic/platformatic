import Ajv from 'ajv'
import { registerHooks } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parentPort, workerData } from 'node:worker_threads'
import { ensureLoggableError } from '../errors.js'
import { canonicalize } from './canonicalize.js'
import { autoWrapApplicationDefinition, classifyConfiguration } from './classify.js'
import { createConfigurationContext } from './context.js'
import {
  ApplicationShorthandConflictError,
  DeferredSlotInApplicationDefinitionError,
  InvalidRootConfigurationError,
  NestedFunctionExportError,
  RootConfigurationInApplicationEntryError
} from './errors.js'
import { topologyVariableName } from './identifiers.js'
import {
  expandAutoload,
  filterEnabledApplications,
  normalizeApplications,
  recordResolveCandidates
} from './topology.js'

const { path, directory, role, applicationId, command, mode, production, schema } = workerData

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

function validateOrchestration (config) {
  if (!schema) {
    return
  }

  // A shape check that injects no defaults: the useDefaults pass runs main-side on the returned
  // snapshot, which is what keeps the recorded projection carrying authored values rather than
  // schema-supplied ones. Coercion is disabled in v4 — on the genuine unions that survive the
  // audit it is a documented hazard rather than a convenience.
  const ajv = new Ajv({ useDefaults: false, coerceTypes: false, allErrors: true, strict: false })
  const validate = ajv.compile(schema)

  if (!validate(config)) {
    const messages = validate.errors
      .map(error => `${error.instancePath || '/'} ${error.message}`)
      .join('; ')

    throw new InvalidRootConfigurationError(path, messages)
  }
}

// Recording the container rather than the index is what makes step 5 survive step 4: expansion can
// append entries and the enabled filter removes them, so a slot addressed by position would be
// spliced into the wrong entry — or into one this boot excludes.
function resolveSlotContainers (config, deferred) {
  return deferred.map(slot => {
    let container = config

    for (const segment of slot.path.slice(0, -1)) {
      container = container[segment]
    }

    return { ...slot, container, key: slot.path[slot.path.length - 1] }
  })
}

async function evaluateRoot (exported, context) {
  // Step 1. Canonicalize before anything reads the value's shape. After this nothing else holds a
  // reference to the original object, which is what closes the time-of-check/time-of-use gap: a
  // getter can return one array to the expansion and another to the walk.
  const { config: snapshot, deferred } = canonicalize(exported, { deferred: true })

  // Step 2. Classify the snapshot, and auto-wrap a bare application definition here.
  const classification = classifyConfiguration(snapshot, path)

  if (classification === 'application') {
    if (deferred.length > 0) {
      // A per-app file has no config slots, so the only thing that path can hold is a capability
      // option that happens to be named config; calling it would be the loader inventing a
      // callback the author never declared.
      throw new DeferredSlotInApplicationDefinitionError(path, deferred[0].pointer)
    }

    const config = autoWrapApplicationDefinition(snapshot)

    normalizeApplications(config, { directory })
    return { config, classification, resolveCandidates: [], warnings: [] }
  }

  const slots = resolveSlotContainers(snapshot, deferred)

  normalizeApplications(snapshot, {
    directory,
    onConflict () {
      throw new ApplicationShorthandConflictError(path, snapshot.autoload ? 'autoload' : 'applications')
    }
  })

  // Step 3. Validate the unexpanded shape — orchestration keys only, since a pending config slot
  // has nothing to validate yet and capability configuration is validated later, main-side.
  validateOrchestration(snapshot)

  // Step 4. Expand autoload, record the resolve projection, then resolve enabled. The recording
  // sits between the two because that is the only moment both lists exist.
  snapshot.applications = await expandAutoload(snapshot, { root: directory })

  const resolveCandidates = recordResolveCandidates(snapshot.applications)

  snapshot.applications = filterEnabledApplications(snapshot.applications, production ? 'production' : 'development')

  const warnings = checkInheritedTopologyKeys(snapshot.applications)

  // Step 5. Call the slots that survived, with the same context the export was called with. Steps
  // 3-5 are in this order for one reason: a disabled entry's config callback must never run.
  const surviving = new Set(snapshot.applications)

  for (const slot of slots) {
    if (!surviving.has(slot.container)) {
      continue
    }

    const resolved = await slot.value(context)

    // No carve-out on the way back: a deferred config may not itself return a function.
    slot.container[slot.key] = canonicalize(resolved).config
  }

  return { config: snapshot, classification, resolveCandidates, warnings }
}

/*
  The root eval worker cannot have the topology keys stripped from its environment the way a
  per-app worker does: the ids that generate those names are declared by the very file being
  evaluated. It gets a post-unwrap check instead — a value visible here is necessarily inherited
  from the surrounding environment rather than injected by this runtime.

  A warning rather than an error, because presence is not use: a nested runtime legitimately passes
  such variables through, and only a config file that actually reads one bakes a stale value.
*/
function checkInheritedTopologyKeys (applications) {
  const warnings = []

  for (const entry of applications) {
    if (typeof entry.id !== 'string') {
      continue
    }

    const name = topologyVariableName(entry.id)

    if (name in process.env) {
      warnings.push({
        type: 'inherited-topology-key',
        key: name,
        applicationId: entry.id,
        message: `${name} was inherited from the surrounding environment; it collides with application '${entry.id}' and is not the value this runtime injects.`
      })
    }
  }

  return warnings
}

async function evaluateApplication (exported) {
  const { config: snapshot } = canonicalize(exported)
  const classification = classifyConfiguration(snapshot, path)

  if (classification === 'root') {
    throw new RootConfigurationInApplicationEntryError(path, applicationId ?? directory)
  }

  return { config: snapshot, classification, resolveCandidates: [], warnings: [] }
}

async function run () {
  // Taken before evaluation, and the context's copy is frozen: one context object is handed to
  // every callback in a file, so ctx.env cannot become a side channel between them.
  const before = { ...process.env }

  const context = createConfigurationContext({
    command,
    mode,
    production,
    env: process.env,
    root: directory,
    onWatchFile (watched) {
      parentPort.postMessage({ type: 'watch', path: watched })
    }
  })

  const module = await import(pathToFileURL(path).toString())
  let exported = module.default

  // Unwrapping is only the function call. Nothing is classified, auto-wrapped or read for its
  // shape yet, and a result that is itself a function is an error naming the file.
  if (typeof exported === 'function') {
    exported = await exported(context)

    if (typeof exported === 'function') {
      throw new NestedFunctionExportError(path)
    }
  }

  const result = role === 'application' ? await evaluateApplication(exported) : await evaluateRoot(exported, context)

  // Mutations still work within the evaluation — it is one thread, one env — they just never
  // silently cross into the runtime. The diff reports keys only: it cannot attribute a write to a
  // module or a line, and the diagnostics must not claim otherwise.
  const mutatedEnvKeys = []

  for (const key of new Set([...Object.keys(before), ...Object.keys(process.env)])) {
    if (before[key] !== process.env[key]) {
      mutatedEnvKeys.push(key)
    }
  }

  return { ...result, mutatedEnvKeys: mutatedEnvKeys.sort() }
}

try {
  const { config, classification, resolveCandidates, warnings, mutatedEnvKeys } = await run()

  parentPort.postMessage({ type: 'result', config, classification, resolveCandidates, warnings, mutatedEnvKeys })
} catch (error) {
  // Errors are posted as plain data rather than as Error instances: structured clone keeps name,
  // message and stack but drops the code, which is the part every caller branches on.
  const { message, code, stack, name } = ensureLoggableError(error)

  parentPort.postMessage({ type: 'error', error: { message, code, stack, name } })
}
