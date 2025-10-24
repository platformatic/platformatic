'use strict'

import { readFile, writeFile, access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import Ajv from 'ajv'
import { schema as wattSchema } from 'wattpm'

const ajv = new Ajv({ allErrors: true, strict: false })

// Get the current package version
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf-8'))

/**
 * Read and parse a Watt configuration file
 */
export async function readWattConfig (configPath) {
  const absolutePath = resolve(configPath)

  try {
    await access(absolutePath)
  } catch {
    throw new Error(`Configuration file not found: ${configPath}`)
  }

  const content = await readFile(absolutePath, 'utf-8')
  const ext = configPath.split('.').pop().toLowerCase()

  let config
  if (ext === 'json') {
    config = JSON.parse(content)
  } else if (ext === 'yaml' || ext === 'yml') {
    config = parseYaml(content)
  } else {
    throw new Error(`Unsupported file format: ${ext}. Only JSON and YAML are supported.`)
  }

  return { config, absolutePath }
}

/**
 * Write a Watt configuration file
 */
export async function writeWattConfig (configPath, config) {
  const absolutePath = resolve(configPath)
  const ext = configPath.split('.').pop().toLowerCase()

  let content
  if (ext === 'json') {
    content = JSON.stringify(config, null, 2)
  } else if (ext === 'yaml' || ext === 'yml') {
    content = stringifyYaml(config, { indent: 2 })
  } else {
    throw new Error(`Unsupported file format: ${ext}. Only JSON and YAML are supported.`)
  }

  await writeFile(absolutePath, content, 'utf-8')
  return absolutePath
}

/**
 * Validate a Watt configuration against the JSON schema
 */
export function validateConfig (config) {
  const validate = ajv.compile(wattSchema)
  const valid = validate(config)

  if (!valid) {
    return {
      valid: false,
      errors: validate.errors.map(err => ({
        path: err.instancePath,
        message: err.message,
        params: err.params
      }))
    }
  }

  return { valid: true, errors: [] }
}

/**
 * Generate a basic Watt configuration
 */
export function generateConfig (options = {}) {
  const {
    type = 'node',
    mainFile = 'index.js',
    port,
    hostname = '0.0.0.0',
    includeLogger = true,
    includeMetrics = false,
    isStandalone = false,
    entrypoint
  } = options

  const config = {
    $schema: `https://schemas.platformatic.dev/@platformatic/${type}/${pkg.version}.json`
  }

  // Add service configuration based on type
  if (type === 'node') {
    config.node = {
      main: mainFile
    }
  } else if (type === 'service') {
    config.service = {
      openapi: true
    }
    // Only add server config if standalone or port is explicitly provided
    if (isStandalone || port !== undefined) {
      config.server = {
        hostname,
        port: port || 3042
      }
    }
  } else if (type === 'db') {
    config.db = {
      connectionString: '{PLT_DATABASE_URL}'
    }
    // Only add server config if standalone or port is explicitly provided
    if (isStandalone || port !== undefined) {
      config.server = {
        hostname,
        port: port || 3042
      }
    }
  } else if (type === 'gateway') {
    config.gateway = {
      services: []
    }
    // Gateway always needs a server config
    config.server = {
      hostname,
      port: port || 3042
    }
  } else if (type === 'runtime') {
    // Runtime configuration with autoload (monorepo pattern - recommended)
    // or applications array
    const { autoloadPath, autoloadExclude } = options

    if (autoloadPath) {
      // Use autoload for monorepo pattern (recommended)
      config.autoload = {
        path: autoloadPath
      }
      if (autoloadExclude && autoloadExclude.length > 0) {
        config.autoload.exclude = autoloadExclude
      }
    } else {
      // Use applications array if no autoload specified
      config.applications = []
    }

    // Add entrypoint if specified
    if (entrypoint) {
      config.entrypoint = entrypoint
    }

    // Add server configuration for the entrypoint
    if (port !== undefined || hostname !== '0.0.0.0') {
      config.server = {
        hostname,
        port: port || 3042
      }
    }
  }

  // Add logger configuration
  if (includeLogger) {
    config.logger = {
      level: 'info'
    }
  }

  // Add metrics configuration
  if (includeMetrics) {
    config.metrics = {
      server: 'hide',
      defaultMetrics: {
        enabled: true
      }
    }
  }

  return config
}

/**
 * Add a service to a runtime configuration
 */
export function addServiceToRuntime (runtimeConfig, serviceConfig) {
  const {
    id,
    path,
    config: serviceConfigPath
  } = serviceConfig

  if (!id) {
    throw new Error('Service ID is required')
  }

  if (!path && !serviceConfigPath) {
    throw new Error('Either path or config is required for the service')
  }

  // Initialize applications array if it doesn't exist (and no autoload is configured)
  if (!runtimeConfig.applications && !runtimeConfig.autoload) {
    runtimeConfig.applications = []
  }

  // Don't add to applications if autoload is configured
  if (runtimeConfig.autoload) {
    throw new Error('Cannot add services manually when autoload is configured. Services are automatically discovered from the autoload path.')
  }

  // Check if service already exists
  const existingIndex = runtimeConfig.applications.findIndex(s => s.id === id)

  const newService = { id }
  if (path) newService.path = path
  if (serviceConfigPath) newService.config = serviceConfigPath

  if (existingIndex >= 0) {
    // Update existing service
    runtimeConfig.applications[existingIndex] = newService
  } else {
    // Add new service
    runtimeConfig.applications.push(newService)
  }

  return runtimeConfig
}
