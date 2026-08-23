import { isAbsolute, resolve } from 'node:path'
import { createConfigurationContext, defaultMode, isProductionCommand } from './context.js'
import { detectCapability } from './detect.js'
import { resolveConfigurationEnvironment, resolveEnvFileSources, stripInjectedTopologyKeys } from './env.js'
import {
  ApplicationConfiguredTwiceError,
  EnvFileOnDecidingDirectoryError,
  EnvFileOnInlineConfigError,
  InvalidApplicationIdError
} from './errors.js'
import { defaultEvaluationTimeout, evaluateConfigurationFile } from './evaluate.js'
import {
  assertValidApplicationId,
  deriveApplicationId,
  findTopologyVariableCollisions,
  topologyVariableName
} from './identifiers.js'
import { readPackageName } from './topology.js'
import {
  findAncestorConfiguration,
  findApplicationConfigurationFile,
  findDecidingFile,
  findEnvRoot,
  resolveNamedConfigurationFile
} from './scope.js'

function resolveEntryDirectory (entry, decidingDirectory) {
  const path = entry.path ?? decidingDirectory

  return isAbsolute(path) ? path : resolve(decidingDirectory, path)
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

// Every eval worker streams its recorded paths through the same sink, so the watcher sees one set
// rather than a per-worker list it has to merge itself.
function createReport ({ onImport, onWatchFile, onWarning, onInfo }) {
  const importedFiles = new Set()
  const watchedFiles = new Set()

  return {
    importedFiles,
    watchedFiles,
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
    }
  }
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

  // --config is not a scope flag, but it does take cwd out of the decision.
  const deciding = configPath
    ? await resolveNamedConfigurationFile(configPath, cwd)
    : await findDecidingFile(cwd, { throwOnMissing: true })

  const decidingEnvRoot = await findEnvRoot(deciding.directory)

  const rootEnv = resolveConfigurationEnvironment({
    realEnv,
    production: resolvedProduction,
    fileSources: await resolveEnvFileSources({
      directory: deciding.directory,
      envRoot: decidingEnvRoot,
      decidingDirectory: deciding.directory,
      decidingEnvRoot,
      mode: resolvedMode,
      customEnvFile
    })
  })

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

  root.config.applications = await prepareApplications({
    entries: root.config.applications ?? [],
    deciding,
    decidingEnvRoot,
    command,
    mode: resolvedMode,
    production: resolvedProduction,
    customEnvFile,
    realEnv,
    timeout,
    report
  })

  return {
    config: root.config,
    configPath: deciding.path,
    root: deciding.directory,
    envRoot: decidingEnvRoot,
    standalone,
    mode: resolvedMode,
    production: resolvedProduction,
    resolveCandidates: root.resolveCandidates,
    importedFiles: [...report.importedFiles],
    watchedFiles: [...report.watchedFiles],
    context: createConfigurationContext({
      command,
      mode: resolvedMode,
      production: resolvedProduction,
      env: rootEnv,
      root: deciding.directory
    })
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

    prepared.config = { module: capability }
    prepared.detected = true
    return prepared
  }

  const env = resolveConfigurationEnvironment({
    realEnv,
    production,
    fileSources: await resolveEnvFileSources({
      directory,
      envRoot: await findEnvRoot(directory),
      decidingDirectory: deciding.directory,
      decidingEnvRoot,
      mode,
      envfile: entry.envfile,
      customEnvFile
    })
  })

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

  prepared.config = evaluated.config
  prepared.configPath = configurationFile

  return prepared
}
