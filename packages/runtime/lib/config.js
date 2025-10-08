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
import { isAbsolute, join, resolve as resolvePath } from 'node:path'
import {
  InspectAndInspectBrkError,
  InspectorHostError,
  InspectorPortError,
  InvalidArgumentError,
  InvalidEntrypointError,
  MissingEntrypointError
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

export function autoDetectPprofCapture (config) {
  const require = createRequire(import.meta.url)

  let pprofCapturePath
  try {
    pprofCapturePath = require.resolve('@platformatic/wattpm-pprof-capture')
  } catch (err) {
    // No-op
  }

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

  // If the application supports its (so far, only @platformatic/service and descendants)
  const { hostname, port, http2, https } = config.server ?? {}
  const server = { hostname, port, http2, https }
  const production = context?.isProduction ?? context?.production

  // Important: do not change the order of the properties in this object
  /* c8 ignore next */
  const wrapped = {
    $schema: schema.$id,
    server,
    watch: !production,
    ...omitProperties(config.runtime ?? {}, runtimeUnwrappablePropertiesList),
    entrypoint: applicationId,
    applications: [
      {
        id: applicationId,
        path: config[kMetadata].root,
        config: config[kMetadata].path
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

export async function transform (config, _, context) {
  const production = context?.isProduction ?? context?.production
  const applications = [...(config.applications ?? []), ...(config.services ?? []), ...(config.web ?? [])]

  const watchType = typeof config.watch
  if (watchType === 'string') {
    config.watch = config.watch === 'true'
  } else if (watchType === 'undefined') {
    config.watch = !production
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

      const application = {
        id,
        config,
        path: entryPath,
        useHttp: !!mapping.useHttp,
        health: mapping.health,
        dependencies: mapping.dependencies
      }
      const existingApplicationId = applications.findIndex(application => application.id === id)

      if (existingApplicationId !== -1) {
        applications[existingApplicationId] = { ...application, ...applications[existingApplicationId] }
      } else {
        applications.push(application)
      }
    }
  }

  config.inspectorOptions = undefined
  parseInspectorOptions(config, context?.inspect, context?.inspectBreak)

  let hasValidEntrypoint = false

  // Root-level workers
  if (typeof config.workers !== 'undefined') {
    const coerced = coercePositiveInteger(config.workers)
    if (coerced === null) {
      const raw = config.workers
      const hint = typeof raw === 'string' && /\{.*\}/.test(raw) ? 'check your environment variable' : ''
      raiseInvalidWorkersError('Runtime', config.workers, hint)
    }
    config.workers = coerced
  }

  for (let i = 0; i < applications.length; ++i) {
    const application = applications[i]

    // We need to have absolute paths here, ot the `loadConfig` will fail
    // Make sure we don't resolve if env var was not replaced
    if (application.path && !isAbsolute(application.path) && !application.path.match(/^\{.*\}$/)) {
      application.path = resolvePath(config[kMetadata].root, application.path)
    }

    if (application.path && application.config) {
      application.config = resolvePath(application.path, application.config)
    }

    try {
      let pkg

      if (application.config) {
        const config = await loadConfiguration(application.config)
        pkg = await loadConfigurationModule(application.path, config)

        application.type = extractModuleFromSchemaUrl(config, true).module
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

    // Validate and coerce per-service workers
    if (typeof application.workers !== 'undefined') {
      const coerced = coercePositiveInteger(application.workers)
      if (coerced === null) {
        const raw = config.application?.[i]?.workers
        const hint = typeof raw === 'string' && /\{.*\}/.test(raw) ? 'check your environment variable' : ''
        raiseInvalidWorkersError(`Service "${application.id}"`, application.workers, hint)
      }
      application.workers = coerced
    }

    application.entrypoint = application.id === config.entrypoint
    application.dependencies ??= []
    application.localUrl = `http://${application.id}.plt.local`

    if (typeof application.watch === 'undefined') {
      application.watch = config.watch
    }

    if (application.entrypoint) {
      hasValidEntrypoint = true
    }
  }

  // If there is no entrypoint, autodetect one
  if (!config.entrypoint) {
    // If there is only one application, it becomes the entrypoint
    if (applications.length === 1) {
      applications[0].entrypoint = true
      config.entrypoint = applications[0].id
      hasValidEntrypoint = true
    } else {
      // Search if exactly application uses @platformatic/gateway
      const gateways = []

      for (const application of applications) {
        if (!application.config) {
          continue
        }

        if (application.type === '@platformatic/gateway') {
          gateways.push(application.id)
        }
      }

      if (gateways.length === 1) {
        applications.find(s => s.id === gateways[0]).entrypoint = true
        config.entrypoint = gateways[0]
        hasValidEntrypoint = true
      }
    }
  }

  if (!hasValidEntrypoint && !context.allowMissingEntrypoint) {
    if (config.entrypoint) {
      throw new InvalidEntrypointError(config.entrypoint)
    } else if (applications.length >= 1) {
      throw new MissingEntrypointError()
    }
    // If there are no applications, and no entrypoint it's an empty app.
    // It won't start, but we should be able to parse and operate on it,
    // like adding other applications.
  }

  if (config.metrics === true) {
    config.metrics = {
      enabled: true,
      timeout: 1000
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
