import Ajv from 'ajv'
import { pathToFileURL } from 'node:url'
import { canonicalize, describeValue, isPlainObject } from './canonicalize.js'
import { autoWrapApplicationDefinition, classifyConfiguration } from './classify.js'
import { createConfigurationContext } from './context.js'
import {
  ApplicationShorthandConflictError,
  DeferredSlotInApplicationDefinitionError,
  InvalidRootConfigurationError,
  MissingDefaultExportError,
  NestedFunctionExportError,
  LegacyApplicationsSpellingError,
  NoApplicationsDeclaredError,
  RootConfigurationInApplicationEntryError
} from './errors.js'
import { topologyVariableName } from './identifiers.js'
import { readAndStripSchemaStamp } from './stamp.js'
import {
  backfillRemotePaths,
  expandAutoload,
  filterEnabledApplications,
  normalizeApplications,
  recordResolveCandidates
} from './topology.js'

/*
  The evaluation pipeline, shared by the eval worker and by --debug-config's in-process mode. It is
  one implementation because the printed configuration has to equal a real boot's; a second one
  written for the diagnostic would be a second contract.
*/

/*
  The minimum shape the pipeline itself relies on, checked whether or not a schema arrived: a
  capability CLI load (`plt db ... -c watt.config.mjs`) has no orchestration schema to pass, and
  without this a malformed `autoload` reached the filesystem walk as a raw TypeError instead of a
  validation error naming the property. The schema, when present, still owns everything else.
*/
function assertOrchestrationShape (config, path) {
  const failures = []

  if (config.autoload !== undefined) {
    if (!isPlainObject(config.autoload)) {
      failures.push(`/autoload: must be an object, not ${describeValue(config.autoload)}`)
    } else if (typeof config.autoload.path !== 'string') {
      // Type only, not non-empty: the runtime schema has no minLength, so a schema-carrying boot
      // accepts '' (it walks the config's own directory), and the stand-in must not be stricter.
      failures.push(`/autoload/path: must be a string, not ${describeValue(config.autoload.path)}`)
    }
  }

  if (config.applications !== undefined) {
    if (!Array.isArray(config.applications)) {
      failures.push(`/applications: must be an array, not ${describeValue(config.applications)}`)
    } else {
      for (let index = 0; index < config.applications.length; index++) {
        if (!isPlainObject(config.applications[index])) {
          failures.push(`/applications/${index}: must be an object, not ${describeValue(config.applications[index])}`)
        }
      }
    }
  }

  if (config.application !== undefined && !isPlainObject(config.application)) {
    failures.push(`/application: must be an object, not ${describeValue(config.application)}`)
  }

  if (failures.length > 0) {
    throw new InvalidRootConfigurationError(path, failures.join('; '))
  }
}

/*
  An application authored with both `module` and `url` is a contradiction -- the module names the
  package it *is*, the url a repository to clone it *from*. It is refused here, on the authored
  config, rather than in the schema: every application ends up with a `module` once the loader records
  its capability, so a schema `not` on module+url would fire on every resolved remote application. On
  the authored snapshot the two are distinguishable, because only a module application authors `module`.
*/
function assertNoModuleUrlConflict (config, path) {
  if (!Array.isArray(config.applications)) {
    return
  }

  const failures = []

  for (let index = 0; index < config.applications.length; index++) {
    const entry = config.applications[index]

    if (isPlainObject(entry) && typeof entry.module === 'string' && typeof entry.url === 'string') {
      failures.push(`/applications/${index}: must not set both 'module' and 'url'`)
    }
  }

  if (failures.length > 0) {
    throw new InvalidRootConfigurationError(path, failures.join('; '))
  }
}

function validateOrchestration (config, { schema, path }) {
  assertNoModuleUrlConflict(config, path)

  // The schema owns the messages when it is present; the shape guard is its stand-in, not a preamble.
  if (!schema) {
    assertOrchestrationShape(config, path)
    return
  }

  /*
    Validated on a throwaway copy with defaults ON, so this pass accepts exactly what the
    main-side pass accepts: a schema is allowed to require a property its own default supplies --
    gracefulShutdown does -- and refusing the authored partial here would reject a configuration
    the documented pipeline loads. The copy is what keeps step 4's projection carrying authored
    values rather than schema-supplied ones: the defaults land on the clone and are discarded.
    Coercion stays disabled -- on the genuine unions that survive the audit it is a documented
    hazard rather than a convenience.
  */
  const ajv = new Ajv({ useDefaults: true, coerceTypes: false, allErrors: true, strict: false })
  const validate = ajv.compile(schema)

  if (!validate(structuredClone(config))) {
    const messages = validate.errors
      .map(error => {
        // Named like the main-side describeFailure: AJV puts the offending property in params, and
        // "must NOT have additional properties" without it is an error the author has to bisect.
        const message = error.params?.additionalProperty
          ? `must NOT have the additional property '${error.params.additionalProperty}'`
          : error.message

        return `${error.instancePath || '/'}: ${message}`
      })
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

  // Step 1b. Read for version detection and stripped, before anything looks at the shape: the
  // schema does not admit it, and classification selects the capability from `module` rather than
  // from a URL that could quietly disagree with it.
  readAndStripSchemaStamp(snapshot, path)

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

  /*
    Before normalization, which is the only moment the question can still be asked: the very next
    step defaults `applications` to an empty list, after which every configuration looks like it
    declared one. v3 drew the same line through its schema -- `services: []` was a statement and
    an absent key was a rejection -- and an empty root config here is a file that boots an empty
    runtime while looking like it configures something. Level 0 is the spelling for "no
    configuration": no file at all.
  */
  if (snapshot.application === undefined && snapshot.applications === undefined && snapshot.autoload === undefined) {
    /*
      Named before the generic refusal: a v3 project renamed to the new file name lands exactly
      here, and "declares no applications" reads as nonsense to an author staring at a services
      list. Beside an `applications` key the same spellings survive to the schema, which refuses
      them by name too.
    */
    const legacySpelling = ['services', 'web'].find(key => snapshot[key] !== undefined)

    if (legacySpelling) {
      throw new LegacyApplicationsSpellingError(path, legacySpelling)
    }

    throw new NoApplicationsDeclaredError(path)
  }

  const slots = resolveSlotContainers(snapshot, deferred)

  /*
    Step 3, on the authored shape. Orchestration keys only: a pending config slot is an absent key
    until step 5 splices it, and capability configuration is validated later, main-side, against
    each capability's own schema. Before normalization on purpose -- the singular `application`
    shorthand legitimately has no id and no path, and folding it into `applications` first would
    validate it against the entry rules that require exactly those.
  */
  validateOrchestration(snapshot, { schema, path })

  normalizeApplications(snapshot, {
    directory,
    onConflict () {
      throw new ApplicationShorthandConflictError(path, snapshot.autoload ? 'autoload' : 'applications')
    }
  })

  // Step 4. The recording sits between expansion and the filter because that is the only moment
  // both lists exist: after expansion, so autoloaded entries are in it, and before the filter,
  // which is what lets resolve fetch an application this boot excludes.
  const autoloadStats = { matched: 0 }
  snapshot.applications = await expandAutoload(snapshot, { root: directory, stats: autoloadStats })

  const warnings = []

  const resolveCandidates = recordResolveCandidates(snapshot.applications)

  /*
    After the recording, so `resolve` still reports a pathless entry by its generated location
    rather than by a path the project never wrote, and before the fan-out, which needs a directory
    for every application whether or not its clone has arrived. The schema's default is applied
    main-side, after this runs, so it is spelled here too.
  */
  backfillRemotePaths(snapshot.applications, snapshot.resolvedApplicationsBasePath ?? 'external')

  snapshot.applications = filterEnabledApplications(snapshot.applications, context.mode)

  /*
    An empty boot is legal -- `applications: []` is a statement, and disabling every entry is a
    choice -- but an autoload that matched no directory at all, leaving nothing to boot, is one
    typo'd path away from a runtime that comes up empty and says nothing. Checked after the
    enabled filter so a disabled explicit entry does not mask it, and gated on the match count so
    deliberately disabling everything autoload found stays silent.
  */
  if (snapshot.autoload && autoloadStats.matched === 0 && snapshot.applications.length === 0) {
    warnings.push({
      type: 'empty-autoload',
      path: snapshot.autoload.path,
      message: `The autoload path '${snapshot.autoload.path}' matched no application directory -- missing directory, no subdirectories, or all excluded -- and no applications remain declared; the runtime will boot empty.`
    })
  }

  warnings.push(...checkInheritedTopologyKeys(snapshot.applications, env))

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

  if (exported === undefined) {
    // Named ahead of canonicalize, which would otherwise reject the undefined at pointer `/` with
    // no file and no mention of the export -- `export const config = {}` is the common way to land
    // here.
    throw new MissingDefaultExportError(path)
  }

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
