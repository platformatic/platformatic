import toml from '@iarna/toml'
import json5 from 'json5'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { parseEnv } from 'node:util'

// Same order used by Wrangler
export const wranglerConfigFiles = ['wrangler.json', 'wrangler.jsonc', 'wrangler.toml']

// Bindings are not inherited by Wrangler environments, they must be redeclared.
// See: https://developers.cloudflare.com/workers/wrangler/environments/
const nonInheritableKeys = [
  'vars',
  'kv_namespaces',
  'd1_databases',
  'r2_buckets',
  'durable_objects',
  'services',
  'queues',
  'ai',
  'browser',
  'hyperdrive',
  'vectorize',
  'analytics_engine_datasets',
  'send_email',
  'mtls_certificates',
  'dispatch_namespaces'
]

export function findWranglerConfigFile (root, configFile) {
  if (configFile) {
    return resolve(root, configFile)
  }

  for (const file of wranglerConfigFiles) {
    const candidate = resolve(root, file)

    if (existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

export async function loadWranglerConfig (root, configFile, environment) {
  const path = findWranglerConfigFile(root, configFile)

  if (!path) {
    return { path: null, config: {} }
  }

  const contents = await readFile(path, 'utf-8')
  let config = extname(path) === '.toml' ? toml.parse(contents) : json5.parse(contents)

  if (environment) {
    const overrides = config.env?.[environment]

    if (!overrides) {
      throw new Error(`Environment "${environment}" not found in Wrangler configuration file "${path}".`)
    }

    const base = { ...config }
    for (const key of nonInheritableKeys) {
      delete base[key]
    }

    config = { ...base, ...overrides }
  }

  delete config.env
  return { path, config }
}

// Wrangler loads local secrets from .dev.vars (or .dev.vars.<environment>) during development
export async function loadDevVars (root, environment) {
  const candidates = environment ? [`.dev.vars.${environment}`, '.dev.vars'] : ['.dev.vars']

  for (const file of candidates) {
    const path = resolve(root, file)

    if (existsSync(path)) {
      return parseEnv(await readFile(path, 'utf-8'))
    }
  }

  return {}
}
