import Ajv from 'ajv'
import { pathToFileURL } from 'node:url'
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
import { expandAutoload, filterEnabledApplications, normalizeApplications, recordResolveCandidates } from './topology.js'

/*
  The evaluation pipeline, shared by the eval worker and by --debug-config's in-process mode. It is
  one implementation because the printed configuration has to equal a real boot's; a second one
  written for the diagnostic would be a second contract.
*/

function validateOrchestration (config, { schema, path }) {
  if (!schema) {
    return
  }

  // A shape check that injects no defaults: the useDefaults pass runs main-side on the returned
  // snapshot, which is what keeps step 4's projection carrying authored values rather than
  // schema-supplied ones. Coercion is disabled in v4 — on the genuine unions that survive the
  // audit it is a documented hazard rather than a convenience.
  const ajv = new Ajv({ useDefaults: false, coerceTypes: false, allErrors: true, strict: false })
  const validate = ajv.compile(schema)

  if (!validate(config)) {
    const messages = validate.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')

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

/*
  The root eval worker cannot have the topology keys stripped from its environment the way a
  per-app worker does: the ids that generate those names are declared by the very file being
  evaluated, and by autoload expansion that completes only after it returns. It gets a post-unwrap
  check instead — a value visible here is necessarily inherited from the surrounding environment
  rather than injected by this runtime.

  A warning rather than an error, because presence is not use: a nested runtime legitimately passes
  such variables through, and only a config file that actually reads one bakes a stale value.
*/
export function checkInheritedTopologyKeys (applications, env) {
  const warnings = []

  for (const entry of applications) {
    if (typeof entry.id !== 'string') {
      continue
    }

    const key = topologyVariableName(entry.id)

    if (key in env) {
      warnings.push({
        type: 'inherited-topology-key',
        key,
        applicationId: entry.id,
        message: `${key} was inherited from the surrounding environment; it collides with application '${entry.id}' and is not the value this runtime injects.`
      })
    }
  }

  return warnings
}

/*
  Everything after the unwrap happens on the canonical snapshot, in this order, because the
  original object is reachable exactly once. Reading module, applications, autoload or a config
  slot off the raw export would re-open the time-of-check/time-of-use gap canonicalization exists
  to close: a getter can return one array to the expansion and another to the walk.
*/
export async function runRootPipeline (exported, { path, directory, schema, production, env, context, deferred: mode = true }) {
  // Step 1.
  const { config: snapshot, deferred } = canonicalize(exported, { deferred: mode })

  // Step 2.
  const classification = classifyConfiguration(snapshot, path)

  if (classification === 'application') {
    if (deferred.length > 0) {
      // A per-app file has no config slots, so the only thing that path can hold there is a
      // capability option that happens to be named config; calling it would be the loader
      // inventing a callback the author never declared.
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

  // Step 3. Orchestration keys only: a pending config slot has nothing to validate yet, and
  // capability configuration is validated later, main-side, against each capability's own schema.
  validateOrchestration(snapshot, { schema, path })

  // Step 4. The recording sits between expansion and the filter because that is the only moment
  // both lists exist: after expansion, so autoloaded entries are in it, and before the filter,
  // which is what lets resolve fetch an application this boot excludes.
  snapshot.applications = await expandAutoload(snapshot, { root: directory })

  const resolveCandidates = recordResolveCandidates(snapshot.applications)

  snapshot.applications = filterEnabledApplications(snapshot.applications, production ? 'production' : 'development')

  const warnings = checkInheritedTopologyKeys(snapshot.applications, env)

  // Step 5. Steps 3-5 are in this order for one reason: a disabled entry's config callback must
  // never run. An entry excluded from this boot may name a capability the production image does
  // not ship, and invoking it to find out would fail a boot that excludes it.
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

export function runApplicationPipeline (exported, { path, applicationId, directory }) {
  const { config } = canonicalize(exported)
  const classification = classifyConfiguration(config, path)

  if (classification === 'root') {
    throw new RootConfigurationInApplicationEntryError(path, applicationId ?? directory)
  }

  return { config, classification, resolveCandidates: [], warnings: [] }
}

// Unwrapping is only the function call: if the export is a function it is called with the context
// and awaited, and a result that is itself a function is an error naming the file. Nothing is
// classified, auto-wrapped or read for its shape yet.
export async function importAndUnwrap (path, context) {
  const module = await import(pathToFileURL(path).toString())
  const exported = module.default

  if (typeof exported !== 'function') {
    return exported
  }

  const resolved = await exported(context)

  if (typeof resolved === 'function') {
    throw new NestedFunctionExportError(path)
  }

  return resolved
}

export function diffEnvironment (before, after) {
  const mutated = []

  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (before[key] !== after[key]) {
      mutated.push(key)
    }
  }

  return mutated.sort()
}

/*
  One evaluation, from import to snapshot. The caller supplies the environment: in a worker it is
  process.env, which the parent constructed explicitly; in-process it is a view installed and
  restored around the call, so the "does not propagate" statement stays true in debug mode too.
*/
export async function evaluateConfiguration ({
  path,
  directory,
  role = 'root',
  applicationId,
  command,
  mode,
  production,
  schema,
  env,
  onWatchFile
}) {
  const before = { ...env }

  const context = createConfigurationContext({ command, mode, production, env, root: directory, onWatchFile })
  const exported = await importAndUnwrap(path, context)

  const result =
    role === 'application'
      ? runApplicationPipeline(exported, { path, applicationId, directory })
      : await runRootPipeline(exported, { path, directory, schema, production, env, context })

  // Mutations still work within the evaluation — it is one thread, one env — they just never
  // silently cross into the runtime. The diff reports keys only: it cannot attribute a write to a
  // module or a line, and the diagnostics must not claim otherwise.
  return { ...result, mutatedEnvKeys: diffEnvironment(before, env) }
}
