import { importCapabilityAndConfig, validationOptions } from '@platformatic/basic'
import {
  extractModuleFromSchemaUrl,
  findConfigurationFile,
  kMetadata,
  loadConfiguration,
  loadConfigurationModule,
  loadModule,
  omitProperties,
  runtimeUnwrappablePropertiesList
} from '@platformatic/foundation'
import { readdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { loadAdditionalApplications } from '@platformatic/foundation/lib/v4/index.js'
import { isAbsolute, join, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  InspectAndInspectBrkError,
  InspectorHostError,
  InspectorPortError,
  InvalidArgumentError
} from './errors.js'
import { schema } from './schema.js'
import { upgrade } from './upgrade.js'

// The runtime package's own entry point, which is where the bundled capability copies live.
const runtimeScopePath = fileURLToPath(new URL('../index.js', import.meta.url))

// Validate and coerce workers values early to avoid runtime hangs when invalid
function coercePositiveInteger (value) {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 1) return null
    return value
  }
  if (typeof value === 'string') {
    // Trim to handle accidental spaces
    const trimmed = value.trim()
    if (trimmed.length === 0) return null
    const num = Number(trimmed)
    if (!Number.isFinite(num) || !Number.isInteger(num) || num < 1) return null
    return num
  }
  return null
}

function raiseInvalidWorkersError (location, received, hint) {
  const extra = hint ? ` (${hint})` : ''
  throw new InvalidArgumentError(`${location} workers must be a positive integer; received "${received}"${extra}`)
}

function parseWorkers (config, prefix, defaultWorkers = { static: 1, dynamic: false }) {
  if (typeof config.workers !== 'undefined') {
    // Number
    if (typeof config.workers !== 'object') {
      const coerced = coercePositiveInteger(config.workers)

      if (coerced === null) {
        const raw = config.workers
        const hint = typeof raw === 'string' && /\{.*\}/.test(raw) ? 'check your environment variable' : ''
        raiseInvalidWorkersError(prefix, config.workers, hint)
      } else {
        config.workers = { static: coerced, dynamic: false }
      }
      // Object
    } else {
      for (const key of ['minimum', 'maximum', 'static']) {
        if (typeof config.workers[key] === 'undefined') {
          continue
        }

        const coerced = coercePositiveInteger(config.workers[key])
        if (coerced === null) {
          const raw = config.workers
          const hint = typeof raw === 'string' && /\{.*\}/.test(raw) ? 'check your environment variable' : ''
          raiseInvalidWorkersError(`${prefix} ${key}`, config.workers, hint)
        } else {
          config.workers[key] = coerced
        }
      }
    }
  } else {
    config.workers = {}
  }

  // Fill missing values from defaults
  for (const key of ['minimum', 'maximum', 'static', 'dynamic']) {
    if (typeof config.workers[key] === 'undefined' && typeof defaultWorkers[key] !== 'undefined') {
      config.workers[key] = defaultWorkers[key]
    }
  }

  // Additional validations
  if (config.workers.maximum < config.workers.minimum) {
    const t = config.workers.minimum
    config.workers.minimum = config.workers.maximum
    config.workers.maximum = t
  }

  if (typeof config.workers.static === 'undefined') {
    config.workers.static = config.workers.minimum
  }
}

export function pprofCapturePreloadPath () {
  const require = createRequire(import.meta.url)

  let pprofCapturePath
  try {
    pprofCapturePath = require.resolve('@platformatic/wattpm-pprof-capture')
  } catch (err) {
    // No-op
  }

  return pprofCapturePath
}

export function autoDetectPprofCapture (config) {
  const pprofCapturePath = pprofCapturePreloadPath()

  // Add to preload if not already present
  if (!config.preload) {
    config.preload = []
  } else if (typeof config.preload === 'string') {
    config.preload = [config.preload]
  }

  if (pprofCapturePath && !config.preload.includes(pprofCapturePath)) {
    config.preload.push(pprofCapturePath)
  }

  return config
}

export async function wrapInRuntimeConfig (config, context) {
  let applicationId = 'main'
  try {
    const packageJson = JSON.parse(await readFile(join(config[kMetadata].root, 'package.json'), 'utf-8'))
    applicationId = packageJson?.name ?? 'main'

    if (applicationId.startsWith('@')) {
      applicationId = applicationId.split('/')[1]
    }
  } catch (err) {
    // on purpose, the package.json might be missing
  }

  const production = context?.isProduction ?? context?.production

  const runtimeConfig = config.runtime ?? {}

  // Important: do not change the order of the properties in this object
  /* c8 ignore next */
  const wrapped = {
    $schema: schema.$id,
    watch: !production,
    ...omitProperties(runtimeConfig, runtimeUnwrappablePropertiesList),
    applications: [
      {
        id: applicationId,
        path: config[kMetadata].root,
        config: config[kMetadata].path,
        ...(runtimeConfig.application ?? {})
      }
    ]
  }

  return loadConfiguration(wrapped, context?.schema ?? schema, {
    validationOptions,
    transform,
    upgrade,
    replaceEnv: true,
    root: config[kMetadata].root,
    ...context
  })
}

export function parseInspectorOptions (config, inspect, inspectBreak) {
  const hasInspect = inspect != null
  const hasInspectBrk = inspectBreak != null

  if (hasInspect && hasInspectBrk) {
    throw new InspectAndInspectBrkError()
  }

  const value = inspectBreak ?? inspect

  if (!value) {
    return
  }

  let host = '127.0.0.1'
  let port = 9229

  if (typeof value === 'string' && value.length > 0) {
    const splitAt = value.lastIndexOf(':')

    if (splitAt === -1) {
      port = value
    } else {
      host = value.substring(0, splitAt)
      port = value.substring(splitAt + 1)
    }

    port = Number.parseInt(port, 10)

    if (!(port === 0 || (port >= 1024 && port <= 65535))) {
      throw new InspectorPortError()
    }

    if (!host) {
      throw new InspectorHostError()
    }
  }

  config.inspectorOptions = { host, port, breakFirstLine: hasInspectBrk, watchDisabled: !!config.watch }
  config.watch = false
}

/*
  The one entry point for applications added while the runtime is running, shared by the HTTP route
  and the management ITC handler so the two cannot drift.

  Under v4 an added application is evaluated exactly as boot evaluates one -- its configuration
  file is found in its own directory, its environment is resolved main-side, and it arrives with
  resolvedConfig. Skipping that leaves the worker to look for a v3 file name that v4 never writes,
  which fails as an unhelpful "unable to initialize the worker".
*/
export async function prepareAddedApplications (config, entries, existingIds = []) {
  const metadata = config[kMetadata]

  if (!metadata?.v4) {
    const prepared = []

    for (const entry of entries) {
      prepared.push(await prepareApplication(config, entry, config.workers))
    }

    return prepared
  }

  const { applications } = await loadAdditionalApplications({
    configPath: metadata.path,
    entries,
    existingIds,
    rootEnvBlock: config.env,
    command: metadata.v4.command,
    mode: metadata.v4.mode,
    production: metadata.v4.production,
    // The runtime is the fallback scope for capability resolution, the same as at boot.
    runtimeScope: runtimeScopePath
  })

  const prepared = []

  for (const application of applications) {
    prepared.push(await prepareV4Application(config, application, config.workers))
  }

  return prepared
}

export async function prepareApplication (config, application, defaultWorkers) {
  // We need to have absolute paths here, ot the `loadConfig` will fail
  // Make sure we don't resolve if env var was not replaced
  if (application.path && !isAbsolute(application.path) && !application.path.match(/^\{.*\}$/)) {
    application.path = resolvePath(config[kMetadata].root, application.path)
  }

  if (application.path && application.config) {
    application.config = resolvePath(application.path, application.config)
  }

  // Skip capability detection for external services (url without path)
  // These services will have their path resolved later in runtime.js #setupApplication
  // Attempting to detect capability here would cause slow glob operations on the cwd
  if (application.url && !application.path) {
    application.type = 'unknown'
  } else {
    try {
      let pkg

      if (application.config) {
        const applicationConfig = await loadConfiguration(application.config)
        pkg = await loadConfigurationModule(application.path, applicationConfig)

        application.type = extractModuleFromSchemaUrl(applicationConfig, true).module
        application.skipTelemetryHooks = pkg.skipTelemetryHooks
      } else {
        const { moduleName, capability } = await importCapabilityAndConfig(application.path)
        pkg = capability

        application.type = moduleName
      }

      application.skipTelemetryHooks = pkg.skipTelemetryHooks

      // This is needed to work around Rust bug on dylibs:
      // https://github.com/rust-lang/rust/issues/91979
      // https://github.com/rollup/rollup/issues/5761
      const _require = createRequire(application.path)
      for (const m of pkg.modulesToLoad ?? []) {
        const toLoad = _require.resolve(m)
        loadModule(_require, toLoad).catch(() => {})
      }
    } catch (err) {
      // This should not happen, it happens on running some unit tests if we prepare the runtime
      // when not all the applications configs are available. Given that we are running this only
      // to ddetermine the type of the application, it's safe to ignore this error and default to unknown
      application.type = 'unknown'
    }
  }

  return finalizeApplication(config, application, defaultWorkers)
}

// Everything an application needs regardless of how its capability was determined. v3 discovers
// that by loading the application's config file; v4 has it from the loader's envelope before any
// worker exists.
export function finalizeApplication (config, application, defaultWorkers) {
  // Validate and coerce per-service workers
  parseWorkers(application, `Service "${application.id}"`, defaultWorkers)

  application.dependencies ??= []
  application.localUrl = `http://${application.id}.plt.local`

  if (typeof application.watch === 'undefined') {
    application.watch = config.watch
  }

  if (typeof application.management === 'undefined' && config.management) {
    application.management = config.management
  }

  return application
}

/*
  The v4 preparation. The loader resolved the path, selected the capability and imported its schema
  subpath — which carries skipTelemetryHooks and modulesToLoad — all main-side, before any worker
  existed. So there is nothing to discover here, and in particular no application config file to
  re-read: that is the whole point of evaluating configuration exactly once per load.
*/
export async function prepareV4Application (config, application, defaultWorkers) {
  // resolvedConfig replaces v3's config file path in workerData: the worker receives the validated
  // capability payload as data and never re-reads a file.
  application.resolvedConfig = application.config ?? {}
  application.config = undefined
  application.type = application.module ?? 'unknown'
  application.skipTelemetryHooks = application.capabilityMetadata?.skipTelemetryHooks ?? false

  // This is needed to work around a Rust bug on dylibs, as in the v3 path.
  const modulesToLoad = application.capabilityMetadata?.modulesToLoad ?? []

  if (modulesToLoad.length > 0 && application.path) {
    const _require = createRequire(application.path)

    for (const m of modulesToLoad) {
      try {
        loadModule(_require, _require.resolve(m)).catch(() => {})
      } catch {
        // A module the capability names but the application cannot resolve is not fatal here; the
        // worker reports it with its own context when it actually needs it.
      }
    }
  }

  return finalizeApplication(config, application, defaultWorkers)
}

function isApplicationEnabled (application, environment) {
  const { enabled } = application

  if (typeof enabled === 'undefined') {
    return true
  }

  if (typeof enabled === 'string') {
    return enabled !== 'false'
  }

  if (typeof enabled === 'object' && enabled !== null) {
    return enabled[environment] ?? true
  }

  return enabled
}

export async function transform (config, _, context) {
  const production = context?.isProduction ?? context?.production
  const environment = production ? 'production' : 'development'
  const applications = [...(config.applications ?? []), ...(config.services ?? []), ...(config.web ?? [])]

  const watchType = typeof config.watch
  if (watchType === 'string') {
    config.watch = config.watch === 'true'
  } else if (watchType === 'undefined') {
    config.watch = !production
  }

  // Migrate the old verticalScaler property, only applied if the new settings are not set, otherwise workers takes precedence
  // TODO: Remove in the next major version
  if (config.verticalScaler) {
    config.workers ??= {}
    config.workers.total ??= config.verticalScaler.maxTotalWorkers
    config.workers.dynamic ??= config.verticalScaler.enabled
    config.workers.minimum ??= config.verticalScaler.minWorkers ?? 1
    config.workers.maximum ??= config.verticalScaler.maxWorkers ?? config.verticalScaler.maxTotalWorkers ?? 1
    config.workers.maxMemory ??= config.verticalScaler.maxTotalMemory

    if (config.verticalScaler.cooldownSec) {
      config.workers.cooldown ??= config.verticalScaler.cooldownSec * 1000
    }
    if (config.verticalScaler.gracePeriod) {
      config.workers.gracePeriod ??= config.verticalScaler.gracePeriod
    }
    if (config.verticalScaler.scaleUpELU) {
      config.workers.scaleUpELU ??= config.verticalScaler.scaleUpELU
    }
    if (config.verticalScaler.scaleDownELU) {
      config.workers.scaleDownELU ??= config.verticalScaler.scaleDownELU
    }

    if (config.verticalScaler.applications) {
      for (const appId in config.verticalScaler.applications) {
        let appConfig = applications.find((app) => app.id === appId)
        if (!appConfig) {
          appConfig = { id: appId, workers: {} }
          applications.push(appConfig)
        }

        const scaleConfig = config.verticalScaler.applications[appId]
        const workersConfig = appConfig.workers ??= {}

        workersConfig.minimum ??= scaleConfig.minWorkers ?? config.workers.minimum
        workersConfig.maximum ??= scaleConfig.maxWorkers ?? config.workers.maximum

        if (scaleConfig.scaleUpELU) {
          workersConfig.scaleUpELU ??= scaleConfig.scaleUpELU
        }
        if (scaleConfig.scaleDownELU) {
          workersConfig.scaleDownELU ??= scaleConfig.scaleDownELU
        }
      }
    }

    config.verticalScaler = undefined
  }

  if (config.autoload) {
    const { exclude = [], mappings = {} } = config.autoload
    let { path } = config.autoload

    path = resolvePath(config[kMetadata].root, path)
    const entries = await readdir(path, { withFileTypes: true })

    for (let i = 0; i < entries.length; ++i) {
      const entry = entries[i]

      if (exclude.includes(entry.name) || !entry.isDirectory()) {
        continue
      }

      const mapping = mappings[entry.name] ?? {}
      const id = mapping.id ?? entry.name
      const entryPath = join(path, entry.name)

      let config
      const configFilename = mapping.config ?? (await findConfigurationFile(entryPath))

      if (typeof configFilename === 'string') {
        config = join(entryPath, configFilename)
      }

      const application = { id, config, path: entryPath, ...mapping }
      const existingApplicationId = applications.findIndex(application => application.id === id)

      if (existingApplicationId !== -1) {
        applications[existingApplicationId] = { ...application, ...applications[existingApplicationId] }
      } else {
        applications.push(application)
      }
    }
  }

  for (let i = applications.length - 1; i >= 0; --i) {
    if (!isApplicationEnabled(applications[i], environment)) {
      applications.splice(i, 1)
    }
  }

  return finalizeConfiguration(config, applications, context, production, prepareApplication)
}

// The half of the transform the loader does not own: inspector options, worker counts, the
// per-application preparation, and the runtime-level normalizations. v4 reaches this directly,
// having already expanded autoload and resolved enabled in the eval worker.
export async function finalizeConfiguration (config, applications, context, production, prepare) {
  config.inspectorOptions = undefined
  parseInspectorOptions(config, context?.inspect, context?.inspectBreak)

  // Root-level workers
  parseWorkers(config, 'Runtime', { static: 1, dynamic: false })
  const defaultWorkers = config.workers

  for (let i = 0; i < applications.length; ++i) {
    await prepare(config, applications[i], defaultWorkers)
  }

  if (typeof config.metrics === 'boolean') {
    config.metrics = {
      enabled: config.metrics,
      timeout: 1000
    }
  }

  if (config.policies?.deny) {
    for (const [from, to] of Object.entries(config.policies.deny)) {
      if (typeof to === 'string') {
        config.policies.deny[from] = [to]
      }
    }
  }

  config.applications = applications
  config.web = undefined
  config.services = undefined
  config.logger ??= {}

  if (production) {
    // Any value below 10 is considered as "immediate restart" and won't be processed via setTimeout or similar
    // Important: do not use 2 otherwise ajv will convert to boolean `true`
    config.restartOnError = 2
  } else {
    if (config.restartOnError === true) {
      config.restartOnError = 5000
    } else if (config.restartOnError < 0) {
      config.restartOnError = 0
    }
  }

  // Auto-detect and add pprof capture if available
  autoDetectPprofCapture(config)

  return config
}

/*
  The v4 transform. What is absent is the point:

  - no alias merging, because `services` and `web` do not exist in v4;
  - no autoload expansion and no `enabled` filtering, because both ran in the root eval worker,
    which is the only place either runs. Leaving them reachable here would let a second expansion
    re-merge entries and read the filesystem after the authoritative snapshot already exists;
  - no verticalScaler migration, which the schema audit removes.

  The `autoload` declaration survives as data beside the expanded list — `GET /metadata` reports it
  and `applications:add --save` needs it to decide whether a new application belongs in a mapping
  or as an explicit entry. It is carried, never re-executed.
*/
export async function transformV4 (config, _, context) {
  const production = context?.isProduction ?? context?.production
  const applications = config.applications ?? []

  if (typeof config.watch === 'undefined') {
    config.watch = !production
  }

  return finalizeConfiguration(config, applications, context, production, prepareV4Application)
}
