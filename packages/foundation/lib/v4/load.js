import { isAbsolute, join, resolve } from 'node:path'
import { createConfigurationContext, defaultMode, isProductionCommand } from './context.js'
import { detectCapability } from './detect.js'
import {
  listChainEnvFilePaths,
  resolveConfigurationEnvironment,
  resolveDirectoryChain,
  resolveEnvFileSources,
  stripInjectedTopologyKeys
} from './env.js'
import {
  ApplicationConfiguredTwiceError,
  CapabilityVersionSkewError,
  EnvFileOnDecidingDirectoryError,
  EnvFileOnInlineConfigError,
  InvalidApplicationIdError,
  ObjectSourceRootRequiredError
} from './errors.js'
import { defaultEvaluationTimeout, evaluateConfigurationFile } from './evaluate.js'
import { configurationFileNames } from './filenames.js'
import {
  assertValidApplicationId,
  deriveApplicationId,
  findTopologyVariableCollisions,
  topologyVariableName
} from './identifiers.js'
import { checkCapabilityVersionSkew } from './capability-resolution.js'
import { runRootPipeline } from './pipeline.js'
import {
  findAncestorConfiguration,
  findAncestorConfigurationOfAnyKind,
  findApplicationConfigurationFile,
  findDecidingFile,
  findEnvRoot,
  listAncestorCandidatePaths,
  resolveNamedConfigurationFile
} from './scope.js'
import { readPackageName } from './topology.js'

export const zeroConfigDefaultPort = 3042

function resolveEntryDirectory (entry, decidingDirectory) {
  const path = entry.path ?? decidingDirectory

  return isAbsolute(path) ? path : resolve(decidingDirectory, path)
}

/*
  The watcher consumes a filtered import list plus everything else a reload depends on that is not
  an import. Imports alone are not the input set: the topology is derived from the filesystem, so
  creating an env file, a config candidate or an autoload directory each change the answer without
  any import changing. Every path is watched for creation and deletion, not only modification,
  which is why most of these do not exist yet.

  The one filter is node_modules, and it is not a project boundary: an application at
  path: '../shared/api' is a supported layout and its config file is in the set. A project-local
  filter would drop exactly the external application config this promises to watch.
*/
function createReport ({ onImport, onWatchFile, onWarning, onInfo }) {
  const importedFiles = new Set()
  const watchedFiles = new Set()
  const watchFiles = new Set()
  const watchDirectories = new Set()

  return {
    importedFiles,
    watchedFiles,
    watchFiles,
    watchDirectories,
    onWarning,
    onInfo,
    onImport (path) {
      if (!importedFiles.has(path)) {
        importedFiles.add(path)
        onImport?.(path)
      }
    },
    onWatchFile (path) {
      if (!watchedFiles.has(path)) {
        watchedFiles.add(path)
        onWatchFile?.(path)
      }
    },
    watch (...paths) {
      for (const path of paths) {
        if (path) {
          watchFiles.add(path)
        }
      }
    },
    watchDirectory (path) {
      watchDirectories.add(path)
    }
  }
}

const nodeModulesPattern = /[\\/]node_modules[\\/]/

function collectWatchTargets (report) {
  const files = new Set(report.watchFiles)

  for (const path of report.watchedFiles) {
    files.add(path)
  }

  for (const path of report.importedFiles) {
    // Watt itself, capability packages and their transitive dependencies are recorded and never
    // watched, so dependency churn cannot trigger reloads or exhaust watcher limits.
    if (!nodeModulesPattern.test(path)) {
      files.add(path)
    }
  }

  return { files: [...files].sort(), directories: [...report.watchDirectories].sort() }
}

function reportMutatedEnv (report, source, keys) {
  if (keys.length === 0) {
    return
  }

  // Keys only: a snapshot diff cannot attribute a write to a module or a line, and the diagnostics
  // must not claim otherwise.
  report.onWarning?.({
    type: 'mutated-env',
    source,
    keys,
    message: `configuration evaluation mutated process.env; these keys do NOT propagate to applications: ${keys.join(', ')}. Use: defineConfig({ env: { … } })`
  })
}

// Both the config-evaluation environment and the enumerable env-file set for one directory come
// from the same two chains, so they are resolved together: the watcher must cover a rung that does
// not exist yet, and a set built from what exists cannot see one appear.
async function resolveEnvironmentFor (
  { directory, envRoot, decidingDirectory, decidingEnvRoot, mode, envfile, customEnvFile, realEnv, production },
  report
) {
  if (customEnvFile) {
    report.watch(isAbsolute(customEnvFile) ? customEnvFile : resolve(directory, customEnvFile))
  } else {
    const ownChain = resolveDirectoryChain(directory, envRoot)
    const decidingChain = resolveDirectoryChain(decidingDirectory, decidingEnvRoot)

    report.watch(...listChainEnvFilePaths(envfile ? ownChain.slice(1) : ownChain, mode))
    report.watch(...listChainEnvFilePaths(decidingChain, mode))

    if (envfile) {
      report.watch(isAbsolute(envfile) ? envfile : resolve(directory, envfile))
    }
  }

  const fileSources = await resolveEnvFileSources({
    directory,
    envRoot,
    decidingDirectory,
    decidingEnvRoot,
    mode,
    envfile,
    customEnvFile
  })

  return resolveConfigurationEnvironment({ realEnv, fileSources, production })
}

/*
  The main-side driver. It resolves the environment for every worker — workers never read env files
  themselves — spawns the root eval worker, then fans out one worker per per-app config file in
  parallel. Evaluation is phased by necessity: the fan-out cannot exist before the root export has
  been evaluated and autoload expanded, and everything discovered then runs concurrently.
*/
export async function loadConfiguration ({
  cwd = process.cwd(),
  configPath,
  command = 'start',
  mode,
  production,
  customEnvFile,
  realEnv = process.env,
  schema,
  timeout = defaultEvaluationTimeout,
  onImport,
  onWatchFile,
  onWarning,
  onInfo
} = {}) {
  const resolvedProduction = production ?? isProductionCommand(command)
  const resolvedMode = mode ?? defaultMode(command, resolvedProduction)
  const report = createReport({ onImport, onWatchFile, onWarning, onInfo })
  const shared = { command, mode: resolvedMode, production: resolvedProduction, customEnvFile, realEnv, timeout }

  // --config is not a scope flag, but it does take cwd out of the decision.
  const deciding = configPath
    ? await resolveNamedConfigurationFile(configPath, cwd)
    : await findDecidingFile(cwd, { throwOnMissing: false })

  // The recognized candidate paths across the whole ancestor horizon are watched because the scan
  // selects the env root: creating ../watt.config.ts moves it outward and makes ../.env live, and
  // neither path is in the active env-file set beforehand — that set is the consequence.
  report.watch(...listAncestorCandidatePaths(deciding?.directory ?? cwd))

  if (!deciding) {
    return synthesizeConfiguration({ cwd, schema, report, ...shared })
  }

  report.watch(deciding.path)

  const decidingEnvRoot = await findEnvRoot(deciding.directory)
  const rootEnv = await resolveEnvironmentFor(
    {
      directory: deciding.directory,
      envRoot: decidingEnvRoot,
      decidingDirectory: deciding.directory,
      decidingEnvRoot,
      ...shared
    },
    report
  )

  const root = await evaluateConfigurationFile({
    path: deciding.path,
    directory: deciding.directory,
    role: 'root',
    env: rootEnv,
    command,
    mode: resolvedMode,
    production: resolvedProduction,
    schema,
    timeout,
    onImport: report.onImport,
    onWatchFile: report.onWatchFile
  })

  for (const warning of root.warnings) {
    report.onWarning?.(warning)
  }

  reportMutatedEnv(report, deciding.path, root.mutatedEnvKeys)

  const standalone = root.classification === 'application'

  if (standalone) {
    // Both conditions earn their place. Without the app-def half, a nested root config would tell
    // the user the mesh is unavailable while a full runtime with a working mesh boots. Without the
    // ancestor half, the canonical single-app project would print it on every boot.
    const ancestor = await findAncestorConfiguration(deciding.directory)

    if (ancestor) {
      report.onWarning?.({
        type: 'standalone-boot',
        ancestor,
        message: `booting standalone — sibling applications and http://*.plt.local are unavailable. Nothing the configuration in ${ancestor} says is applied: neither its own settings (logger, telemetry, the env blocks, envfile) nor this application's entry (workers, health, dependencies, enabled). Its own server settings are unchanged: it listens exactly as it does under the full runtime.`
      })
    }
  }

  return assemble({
    result: root,
    deciding,
    decidingEnvRoot,
    rootEnv,
    standalone,
    report,
    ...shared
  })
}

/*
  Object config sources skip the root eval worker. The programmatic API and the zero-config
  synthesis pass an object, not a file: for those the root pipeline runs main-side with no import
  step, and the environment is built without mutating the main process's process.env.

  The root argument stands in for the deciding file's directory — there is no config file to take a
  dirname of. Where the walk floors differs between the two sources, which is why the caller
  supplies envRoot: an embedder saying create('/app', …) declared its root and does not mean "and
  also whatever .env sits above /app", while synthesis, where nobody declared anything, resolves
  its env root the same way a config file would.
*/
export async function loadObjectConfiguration ({
  root,
  source,
  envRoot,
  command = 'start',
  mode,
  production,
  customEnvFile,
  realEnv = process.env,
  schema,
  timeout = defaultEvaluationTimeout,
  onImport,
  onWatchFile,
  onWarning,
  onInfo,
  report,
  synthesized = false,
  standalone
} = {}) {
  if (typeof root !== 'string' || root.length === 0) {
    throw new ObjectSourceRootRequiredError()
  }

  const resolvedProduction = production ?? isProductionCommand(command)
  const resolvedMode = mode ?? defaultMode(command, resolvedProduction)
  const shared = { command, mode: resolvedMode, production: resolvedProduction, customEnvFile, realEnv, timeout }

  report ??= createReport({ onImport, onWatchFile, onWarning, onInfo })

  const deciding = { path: null, directory: root, stopDirectory: root }
  const decidingEnvRoot = envRoot ?? root
  const rootEnv = await resolveEnvironmentFor(
    { directory: root, envRoot: decidingEnvRoot, decidingDirectory: root, decidingEnvRoot, ...shared },
    report
  )

  const context = createConfigurationContext({
    command,
    mode: resolvedMode,
    production: resolvedProduction,
    env: rootEnv,
    root
  })

  // Canonicalized in the same position the root worker uses — before autoload expansion or any
  // other read of the object's shape. An embedder can hand create() an object carrying getters or
  // a Proxy just as easily as a config file can build one.
  const evaluated = await runRootPipeline(source, {
    path: root,
    directory: root,
    schema,
    production: resolvedProduction,
    env: rootEnv,
    context,
    deferred: 'reject'
  })

  for (const warning of evaluated.warnings) {
    report.onWarning?.(warning)
  }

  return assemble({
    result: { ...evaluated, importedFiles: [], watchedFiles: [] },
    deciding,
    decidingEnvRoot,
    rootEnv,
    // standalone means no root orchestration was read. An app-def export satisfies it because the
    // root config, if any, was never evaluated; synthesis satisfies it because there was nothing
    // to evaluate at all — which is why it says so rather than being inferred from a shape it
    // does not have, the synthesized source being written in the singular root form.
    standalone: standalone ?? evaluated.classification === 'application',
    synthesized,
    report,
    ...shared
  })
}

/*
  Level 0. The synthesized configuration supplies a port of Number(env.PORT || 3042), where env is
  the map already resolved for that directory: with the entrypoint gone a framework application
  carrying no server.port would start nothing. Reading the ambient process.env instead would ignore
  a PORT=4000 sitting in the project's own .env — the one file a zero-config user is most likely to
  have written — because synthesis runs main-side and does not mutate process.env.
*/
async function synthesizeConfiguration ({ cwd, schema, report, ...shared }) {
  // Nobody declared a root here, so the env root is resolved the same way a config file's would
  // be, flooring at the directory itself. Without that, running in web/api of a monorepo would
  // synthesize an application that cannot see the root .env.
  const envRoot = await findEnvRoot(cwd)
  const env = await resolveEnvironmentFor(
    { directory: cwd, envRoot, decidingDirectory: cwd, decidingEnvRoot: envRoot, ...shared },
    report
  )

  // Never refused on account of a configuration above: refusing would mean deciding that an
  // ancestor config describes this directory, which a filename check cannot establish and an
  // evaluation could only establish by executing a file above the search's stop point.
  const ancestor = await findAncestorConfigurationOfAnyKind(cwd)

  if (ancestor) {
    report.onWarning?.({
      type: 'synthesized-under-ancestor',
      ancestor: ancestor.path,
      legacy: ancestor.legacy,
      message: ancestor.legacy
        ? `${cwd} has no watt.config.* of its own and is booting with inferred defaults. A v3 configuration exists at ${ancestor.path}, which this version cannot read. Run npx wattpm-utils@4 migrate there, then run wattpm from that directory.`
        : `${cwd} has no watt.config.* of its own and is booting with inferred defaults. A Watt configuration exists at ${ancestor.path}; if it describes this application, none of what it says — workers, health, env, telemetry, and the port it assigns — is applied here. Run wattpm there to start it with the runtime, or add a watt.config.ts here to configure it standalone.`
    })
  }

  const { capability } = await detectCapability(cwd)

  report.onInfo?.({
    type: 'synthesized-configuration',
    capability,
    message: `no configuration file found; booting ${cwd} as ${capability} with inferred defaults`
  })

  // The convention lives in configuration rather than becoming a hidden loader default: synthesis
  // simply is the configuration for a zero-config boot. It applies only to a single-application
  // project, which is the only shape zero-config can produce.
  const source = {
    application: {
      config: {
        module: capability,
        server: { port: Number(env.PORT || zeroConfigDefaultPort) }
      }
    }
  }

  return loadObjectConfiguration({
    root: cwd,
    source,
    envRoot,
    schema,
    report,
    synthesized: true,
    standalone: true,
    ...shared
  })
}

async function assemble ({
  result,
  deciding,
  decidingEnvRoot,
  rootEnv,
  standalone,
  synthesized = false,
  report,
  command,
  mode,
  production,
  customEnvFile,
  realEnv,
  timeout
}) {
  const config = result.config

  if (config.autoload?.path) {
    // Creating or removing an application directory changes the application list, so the directory
    // itself is watched for membership rather than only its current members.
    const path = isAbsolute(config.autoload.path)
      ? config.autoload.path
      : resolve(deciding.directory, config.autoload.path)

    report.watchDirectory(path)
  }

  config.applications = await prepareApplications({
    entries: config.applications ?? [],
    deciding,
    decidingEnvRoot,
    command,
    mode,
    production,
    customEnvFile,
    realEnv,
    timeout,
    report
  })

  return {
    config,
    configPath: deciding.path,
    root: deciding.directory,
    envRoot: decidingEnvRoot,
    standalone,
    synthesized,
    mode,
    production,
    resolveCandidates: result.resolveCandidates,
    importedFiles: [...report.importedFiles],
    watchedFiles: [...report.watchedFiles],
    watchTargets: collectWatchTargets(report),
    context: createConfigurationContext({ command, mode, production, env: rootEnv, root: deciding.directory })
  }
}

async function prepareApplications ({ entries, deciding, ...shared }) {
  // The ids have to be known before the fan-out: they name the topology variables each per-app
  // worker has stripped from its environment, and they are checked before reaching either
  // consumer — the mesh hostname and the variable normalization.
  const identified = await Promise.all(
    entries.map(async entry => {
      const directory = resolveEntryDirectory(entry, deciding.directory)

      // The same three rungs autoload uses: an explicit id, then the package.json name with any
      // scope stripped, then the directory name. A default that varied by position would move the
      // mesh hostname, the injected variable, the metrics label, wattpm inject's argument and the
      // dependencies spelling all at once.
      const derived = deriveApplicationId({
        id: entry.id,
        packageName: entry.id ? undefined : await readPackageName(directory),
        directory
      })

      assertValidApplicationId(derived.id, derived.source)
      return { entry, directory, id: derived.id }
    })
  )

  const [collision] = findTopologyVariableCollisions(identified.map(({ id }) => id))

  if (collision) {
    // The label grammar removes most of the ways this could happen, so what remains is a case
    // difference — and DNS labels being case-insensitive, those are the same mesh hostname too.
    throw new InvalidApplicationIdError(
      JSON.stringify(collision.ids.join(', ')),
      `two application ids normalizing to ${collision.name}`
    )
  }

  const injectedNames = identified.map(({ id }) => topologyVariableName(id))

  // Per-app files are independent by definition — cross-file coordination was never supported — so
  // parallel evaluation is safe and typically faster than any serial scheme.
  return Promise.all(
    identified.map(application => prepareApplication({ ...application, injectedNames, deciding, ...shared }))
  )
}

async function prepareApplication ({
  entry,
  directory,
  id,
  injectedNames,
  deciding,
  decidingEnvRoot,
  command,
  mode,
  production,
  customEnvFile,
  realEnv,
  timeout,
  report
}) {
  const prepared = { ...entry, id, path: directory }

  // Adding or deleting a watt.config.ts in an application directory changes which applications own
  // a file — and, after the scoping rule, what wattpm dev does there — so the candidates are
  // watched whether or not one exists. The package.json is watched for the same reason: it supplies
  // the id and the dependencies the detector reads.
  report.watch(...configurationFileNames.map(name => join(directory, name)), join(directory, 'package.json'))

  // Discovery skips a candidate that is the deciding file itself, whatever the entry's shape: an
  // entry whose directory is the deciding file's own falls through to the detector rather than
  // re-reading the file that produced it.
  const configurationFile = await findApplicationConfigurationFile(directory, deciding.path)

  if (entry.config !== undefined) {
    if (configurationFile) {
      // A root boot must not have two sources for one application. No evaluation is involved, and
      // the deciding file itself is exempt, so a Level 1 auto-wrap never trips it.
      throw new ApplicationConfiguredTwiceError(id, configurationFile)
    }

    if (entry.envfile) {
      // No file is read for this entry, so the envfile would govern the worker-runtime view alone,
      // and a key that silently covers one view and not the other is the ambiguity this format
      // exists to remove. A deliberate simplification rather than an impossibility.
      throw new EnvFileOnInlineConfigError(id)
    }

    applyDefinition(prepared, entry.config, { directory, report })
    return prepared
  }

  if (entry.envfile && directory === deciding.directory) {
    // Not a simplification but an ordering impossibility: the root worker's environment is
    // resolved from the deciding file's own directory chain before that file is evaluated, and the
    // entry's envfile does not exist until after. Applying it would mean reading the configuration
    // in order to build the environment that produces the configuration.
    throw new EnvFileOnDecidingDirectoryError(id, deciding.path)
  }

  if (!configurationFile) {
    // Neither an inline config nor a per-app file: one deterministic detector run. A third shape
    // with no eval worker, and the one an envfile is not refused for — nothing is evaluated, so
    // there is no evaluation view for it to be absent from.
    const { capability, source } = await detectCapability(directory, { id })

    report.onInfo?.({
      type: 'detected-capability',
      id,
      capability,
      source,
      message: `${id} → ${capability} (detected)`
    })

    prepared.module = capability
    prepared.config = {}
    prepared.detected = true

    if (entry.envfile) {
      report.watch(isAbsolute(entry.envfile) ? entry.envfile : resolve(directory, entry.envfile))
    }

    return prepared
  }

  report.watch(configurationFile)

  const env = await resolveEnvironmentFor(
    {
      directory,
      envRoot: await findEnvRoot(directory),
      decidingDirectory: deciding.directory,
      decidingEnvRoot,
      mode,
      envfile: entry.envfile,
      customEnvFile,
      realEnv,
      production
    },
    report
  )

  // Injection is a runtime act with no rung in the config-evaluation ladder, so the declared
  // topology keys are stripped from every per-app worker: a config file reading one during
  // evaluation would bake a stale value into resolvedConfig, where runtime injection can no longer
  // reach it.
  stripInjectedTopologyKeys(env, injectedNames, realEnv)

  const evaluated = await evaluateConfigurationFile({
    path: configurationFile,
    directory,
    role: 'application',
    applicationId: id,
    env,
    command,
    mode,
    production,
    timeout,
    onImport: report.onImport,
    onWatchFile: report.onWatchFile
  })

  reportMutatedEnv(report, configurationFile, evaluated.mutatedEnvKeys)

  applyDefinition(prepared, evaluated.config, { directory, report })
  prepared.configPath = configurationFile

  return prepared
}

/*
  module and version are loader metadata, not capability options. They are stripped into the entry's
  envelope before the capability's AJV validation and transform run, so capability schemas keep
  additionalProperties: false and gain no reserved properties — a stamped factory result validates
  as cleanly as a hand-written one. They surface on the entry as module and definitionVersion, the
  latter renamed on the way out because getApplicationDetails().version already means the capability
  version the running worker loaded.
*/
function applyDefinition (prepared, definition, { directory, report }) {
  const { module, version, ...payload } = definition

  prepared.config = payload

  if (module) {
    prepared.module = module
  }

  if (version) {
    prepared.definitionVersion = version
  }

  const skew = checkCapabilityVersionSkew({
    id: prepared.id,
    module,
    stamped: version,
    applicationRoot: directory
  })

  if (!skew) {
    return
  }

  if (skew.level === 'error') {
    throw new CapabilityVersionSkewError(skew.message)
  }

  // Minor drift is legitimate mid-upgrade, so it warns rather than failing the boot.
  report.onWarning?.({ type: 'capability-version-skew', ...skew })
}
