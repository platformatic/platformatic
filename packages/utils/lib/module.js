import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { request } from 'undici'
import { hasJavascriptFiles } from './file-system.js'

let platformaticPackageVersion

export const kFailedImport = Symbol('plt.utils.failedImport')

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

  if (hasDependency(packageJson, '@nestjs/core')) {
    name = '@platformatic/nest'
    label = 'NestJS'
  } else if (hasDependency(packageJson, 'next')) {
    name = '@platformatic/next'
    label = 'Next.js'
  } else if (hasDependency(packageJson, '@remix-run/dev')) {
    name = '@platformatic/remix'
    label = 'Remix'
  } else if (hasDependency(packageJson, 'astro')) {
    name = '@platformatic/astro'
    label = 'Astro'
    // Since Vite is often used with other frameworks, we must check for Vite last
  } else if (hasDependency(packageJson, 'vite')) {
    name = '@platformatic/vite'
    label = 'Vite'
  } else if (await hasJavascriptFiles(root)) {
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
      /* c8 ignore next 4 */
      if (err.code === 'ERR_REQUIRE_ESM') {
        const toLoad = require.resolve(path)
        loaded = await import('file://' + toLoad)
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
