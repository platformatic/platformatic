import { importCapabilityAndConfig, validationOptions } from '@platformatic/basic'
import {
  createDirectory,
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
import { createRequire, findPackageJSON } from 'node:module'
import { dirname, isAbsolute, join, resolve as resolvePath } from 'node:path'

import {
  ApplicationsPortsOverlapError,
  InspectAndInspectBrkError,
  InspectorHostError,
  InspectorPortError,
  InvalidArgumentError,
  MissingDependencyError
} from './errors.js'
import { schema } from './schema.js'
import { upgrade } from './upgrade.js'

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

// Set by prepareApplication so that transform can check for port overlaps without loading the
// application configurations a second time. Removed as soon as the check is done.
const kDeclaredListener = Symbol('plt.runtime.config.declaredListener')

const hostnameWildcards = new Set(['0.0.0.0', '::', '[::]'])

// The listener an application declares in its own configuration, when it can be determined without
// starting it. A port coming from an environment variable which was not replaced, an ephemeral port
// and a missing server block all yield null, in which case only the start time check applies.
function declaredListener (applicationConfig) {
  const server = applicationConfig?.server

  if (!server) {
    return null
  }

  const port = Number(server.port)

  if (!Number.isInteger(port) || port <= 0) {
    return null
  }

  return { port, hostname: server.hostname, perWorker: server.portAssignment === 'perWorkerIncrement' }
}

// Two declared listeners can only be compared when both hostnames are known. When a hostname is
// omitted the capability picks its own default, so unless the other side is a wildcard - which
// overlaps with anything - the comparison is left to the start time check.
function declaredListenersOverlap (first, second) {
  const hostname = first.hostname?.toLowerCase()
  const otherHostname = second.hostname?.toLowerCase()

  // A wildcard overlaps with any other hostname, known or not
  if (hostnameWildcards.has(hostname) || hostnameWildcards.has(otherHostname)) {
    return true
  }

  // Both applications rely on the same capability default, so they do collide
  if (typeof hostname === 'undefined' && typeof otherHostname === 'undefined') {
    return true
  }

  // Only one of the two defaults is unknown, so nothing can be concluded here
  if (typeof hostname === 'undefined' || typeof otherHostname === 'undefined') {
    return false
  }

  return hostname === otherHostname
}

function describeDeclaredPorts (listener) {
  const { port, last } = listener
  return port === last ? `port ${port}` : `ports ${port}-${last}, one per worker`
}

// Rejects applications whose declared ports overlap before any of them is started, so that the
// failure does not depend on which worker happens to report its URL first. This is best effort:
// applications whose port cannot be determined here are checked when their workers start.
function verifyApplicationsPorts (applications) {
  const listeners = []

  for (const application of applications) {
    const listener = application[kDeclaredListener]
    delete application[kDeclaredListener]

    // Dynamic scaling changes how many ports the application ends up using, so leave it to the start time check
    if (!listener || application.workers?.dynamic) {
      continue
    }

    const workers = listener.perWorker ? (application.workers?.static ?? 1) : 1
    listeners.push({ ...listener, id: application.id, last: listener.port + workers - 1 })
  }

  for (let i = 0; i < listeners.length; i++) {
    for (let j = i + 1; j < listeners.length; j++) {
      const first = listeners[i]
      const second = listeners[j]

      const port = Math.max(first.port, second.port)

      if (port > Math.min(first.last, second.last) || !declaredListenersOverlap(first, second)) {
        continue
      }

      throw new ApplicationsPortsOverlapError(
        first.id,
        describeDeclaredPorts(first),
        second.id,
        describeDeclaredPorts(second),
        port
      )
    }
  }
}

export async function prepareApplication (config, application, defaultWorkers) {
  // We need to have absolute paths here, ot the `loadConfig` will fail
  // Make sure we don't resolve if env var was not replaced
  if (application.path && !isAbsolute(application.path) && !application.path.match(/^\{.*\}$/)) {
    application.path = resolvePath(config[kMetadata].root, application.path)
  }

  if (application.module) {
    if (!application.path) {
      throw new InvalidArgumentError(`Application "${application.id}" must define path when module is set`)
    }

    try {
      application.sourcePath = dirname(findPackageJSON(application.module, resolvePath(config[kMetadata].root, 'noop.js')))
    } catch (error) {
      throw new MissingDependencyError(application.module, { cause: error })
    }
    application.moduleRoot = config[kMetadata].root
    await createDirectory(application.path)
  }

  if (application.path && application.config) {
    application.config = resolvePath(application.path, application.config)
  }

  // Skip capability detection for external services (url without path)
  // These services will have their path resolved later in runtime.js #setupApplication
  // Attempting to detect capability here would cause slow glob operations on the cwd
  if (application.module) {
    application.type = application.module
  } else if (application.url && !application.path) {
    application.type = 'unknown'
  } else {
    try {
      let pkg

      if (application.config) {
        const applicationConfig = await loadConfiguration(application.config)

        // Recorded before loading the capability so that it survives a capability which cannot be resolved
        application[kDeclaredListener] = declaredListener(applicationConfig)

        pkg = await loadConfigurationModule(application.path, applicationConfig)

        application.type = extractModuleFromSchemaUrl(applicationConfig, true).module
        application.skipTracingHooks = pkg.skipTracingHooks
      } else {
        const { moduleName, capability } = await importCapabilityAndConfig(application.path)
        pkg = capability

        application.type = moduleName
      }

      application.skipTracingHooks = pkg.skipTracingHooks

      // This is needed to work around Rust bug on dylibs:
      // https://github.com/rust-lang/rust/issues/91979
      // https://github.com/rollup/rollup/issues/5761
      const _require = createRequire(application.sourcePath ?? application.path)
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

  config.inspectorOptions = undefined
  parseInspectorOptions(config, context?.inspect, context?.inspectBreak)

  // Root-level workers
  parseWorkers(config, 'Runtime', { static: 1, dynamic: false })
  const defaultWorkers = config.workers

  for (let i = 0; i < applications.length; ++i) {
    await prepareApplication(config, applications[i], defaultWorkers)
  }

  verifyApplicationsPorts(applications)

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
