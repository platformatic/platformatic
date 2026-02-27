import { existsSync, readFileSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { request } from 'undici'
import { hasJavascriptFiles } from './file-system.js'
import { kFailedImport } from './symbols.js'

let platformaticPackageVersion

export const defaultPackageManager = 'npm'

// Keep this in sync with packages/create-wattpm/lib/index.js.
// @platformatic/node is purposely missing as it's the fallback option.
export const applicationTypes = [
  { name: '@platformatic/nest', label: 'NestJS', dependencies: ['@nestjs/core'] },
  { name: '@platformatic/next', label: 'Next.js', dependencies: ['next'] },
  { name: '@platformatic/remix', label: 'Remix', dependencies: ['@remix-run/dev'] },
  { name: '@platformatic/astro', label: 'Astro', dependencies: ['astro'] },
  // Since Vite is often used with other frameworks, we must check for Vite last amongst frontend frameworks
  { name: '@platformatic/vite', label: 'Vite', dependencies: ['vite'] },
  {
    name: '@platformatic/gateway',
    label: 'Platformatic Gateway',
    dependencies: ['@platformatic/gateway', '@platformatic/composer']
  },
  { name: '@platformatic/service', label: 'Platformatic Service', dependencies: ['@platformatic/service'] },
  { name: '@platformatic/db', label: 'Platformatic DB', dependencies: ['@platformatic/db'] },
  { name: '@platformatic/php', label: 'Platformatic PHP', dependencies: ['@platformatic/php'] },
  { name: '@platformatic/ai-warp', label: 'AI-Warp', dependencies: ['@platformatic/ai-warp'] },
  { name: '@platformatic/pg-hooks', label: 'Platformatic PostgreSQL Hooks', dependencies: ['@platformatic/pg-hooks'] },
  {
    name: '@platformatic/rabbitmq-hooks',
    label: 'Platformatic RabbitMQ Hooks',
    dependencies: ['@platformatic/rabbitmq-hooks']
  },
  { name: '@platformatic/kafka-hooks', label: 'Platformatic Kafka Hooks', dependencies: ['@platformatic/kafka-hooks'] }
]

export async function getLatestNpmVersion (pkg) {
  const res = await request(`https://registry.npmjs.org/${pkg}`)
  if (res.statusCode === 200) {
    const json = await res.body.json()
    return json['dist-tags'].latest
  }
  return null
}

export function getPkgManager () {
  const userAgent = process.env.npm_config_user_agent
  if (!userAgent) {
    return 'npm'
  }
  const pmSpec = userAgent.split(' ')[0]
  const separatorPos = pmSpec.lastIndexOf('/')
  const name = pmSpec.substring(0, separatorPos)
  return name || 'npm'
}

// This should never fail, except if the package.json is bundled in systems like Vite RSC
export function parsePackageJSON (root, relativePath = '..') {
  try {
    return JSON.parse(readFileSync(resolve(root, `${relativePath}/package.json`), 'utf8'))
  } catch (err) {
    return { name: dirname(root), version: '0.0.0' }
  }
}

/**
 * Get the package manager used in the project by looking at the lock file
 *
 * if `search` is true, will search for the package manager in a nested directory
 */
export async function getPackageManager (root, defaultManager = defaultPackageManager, search = false) {
  if (existsSync(resolve(root, 'pnpm-lock.yaml'))) {
    return 'pnpm'
  }

  if (existsSync(resolve(root, 'yarn.lock'))) {
    return 'yarn'
  }

  if (existsSync(resolve(root, 'package-lock.json'))) {
    return 'npm'
  }

  // search for the package manager in a nested directory
  if (search) {
    // look in the first level nested directory
    for (const dir of await readdir(root)) {
      const p = await getPackageManager(resolve(root, dir), null)
      if (p) {
        return p
      }
    }
  }

  return defaultManager
}

export function getInstallationCommand (packageManager, production) {
  const args = ['install']
  if (production) {
    switch (packageManager) {
      case 'pnpm':
        args.push('--prod')
        break
      case 'yarn':
        args.push('--production')
        break
      case 'npm':
        args.push('--omit=dev')
        break
    }
  }
  return args
}

export async function getPlatformaticVersion () {
  if (!platformaticPackageVersion) {
    const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf-8'))
    platformaticPackageVersion = packageJson.version
    return platformaticPackageVersion
  }

  return platformaticPackageVersion
}

export function hasDependency (packageJson, dependency) {
  return packageJson.dependencies?.[dependency] || packageJson.devDependencies?.[dependency]
}

export function splitModuleFromVersion (module) {
  if (!module) {
    return {}
  }
  const versionMatcher = module.match(/(.+)@(\d+.\d+.\d+)/)
  let version
  if (versionMatcher) {
    module = versionMatcher[1]
    version = versionMatcher[2]
  }
  return { module, version }
}

export async function detectApplicationType (root, packageJson) {
  if (!packageJson) {
    try {
      packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf-8'))
    } catch {
      packageJson = {}
    }
  }

  let name
  let label

  for (const appType of applicationTypes) {
    if (appType.dependencies.some(dep => hasDependency(packageJson, dep))) {
      name = appType.name
      label = appType.label
      break
    }
  }

  if (!name && (await hasJavascriptFiles(root))) {
    // If no specific framework is detected, we assume it's a generic Node.js application
    name = '@platformatic/node'
    label = 'Node.js'
  }

  return name ? { name, label } : null
}

export async function loadModule (require, path) {
  if (path.startsWith('file://')) {
    path = fileURLToPath(path)
  }

  let loaded
  try {
    try {
      loaded = require(path)
    } catch (err) {
      /* c8 ignore next 10 */
      if (err.code === 'ERR_REQUIRE_ESM') {
        const toLoad = require.resolve(path)

        // Given require(esm) this is unlikely to happen, but we leave it just in case.
        // The reason for eval is that some tools like Turbopack might do static analysis and complain.
        // eslint-disable-next-line no-eval
        return await eval(`import('file://${toLoad}')`)
      } else {
        throw err
      }
    }
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'MODULE_NOT_FOUND') {
      err[kFailedImport] = path
    }

    throw err
  }

  return loaded?.default ?? loaded
}
