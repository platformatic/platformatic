'use strict'

import { readFile, writeFile, access } from 'node:fs/promises'
import { resolve, dirname, join } from 'node:path'

// Get the current package version
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf-8'))
const PLATFORMATIC_VERSION = `^${pkg.version}`

/**
 * Get required dependencies for a Watt configuration type
 */
export function getRequiredDependencies (type) {
  const deps = {
    wattpm: PLATFORMATIC_VERSION
  }

  switch (type) {
    case 'node':
      deps['@platformatic/node'] = PLATFORMATIC_VERSION
      break
    case 'service':
      deps['@platformatic/service'] = PLATFORMATIC_VERSION
      break
    case 'db':
      deps['@platformatic/db'] = PLATFORMATIC_VERSION
      break
    case 'gateway':
      deps['@platformatic/gateway'] = PLATFORMATIC_VERSION
      break
  }

  return deps
}

/**
 * Read or create a package.json file
 */
export async function readOrCreatePackageJson (configPath, serviceName) {
  const dir = dirname(resolve(configPath))
  const packageJsonPath = join(dir, 'package.json')

  try {
    await access(packageJsonPath)
    const content = await readFile(packageJsonPath, 'utf-8')
    return { packageJson: JSON.parse(content), packageJsonPath, exists: true }
  } catch {
    // Create a basic package.json
    // Use service name if provided (for npm workspaces), otherwise default name
    const packageJson = {
      name: serviceName || 'watt-app',
      version: '1.0.0',
      type: 'module',
      scripts: {
        start: 'watt start'
      },
      dependencies: {}
    }
    return { packageJson, packageJsonPath, exists: false }
  }
}

/**
 * Update package.json with required dependencies
 */
export async function updatePackageJsonDependencies (configPath, type, serviceName) {
  const { packageJson, packageJsonPath, exists } = await readOrCreatePackageJson(configPath, serviceName)
  const requiredDeps = getRequiredDependencies(type)

  // Initialize dependencies if missing
  if (!packageJson.dependencies) {
    packageJson.dependencies = {}
  }

  // Initialize scripts if missing
  if (!packageJson.scripts) {
    packageJson.scripts = {}
  }

  let updated = false
  const addedDeps = []
  const updatedDeps = []

  // Add or update required dependencies
  for (const [dep, version] of Object.entries(requiredDeps)) {
    if (!packageJson.dependencies[dep]) {
      packageJson.dependencies[dep] = version
      addedDeps.push(dep)
      updated = true
    } else if (packageJson.dependencies[dep] !== version) {
      // Update dependency if version is different
      packageJson.dependencies[dep] = version
      updatedDeps.push(dep)
      updated = true
    }
  }

  // Remove old platformatic dependencies that shouldn't be there
  const depsToRemove = ['fastify', 'platformatic']
  for (const dep of depsToRemove) {
    if (packageJson.dependencies[dep]) {
      delete packageJson.dependencies[dep]
      updated = true
    }
  }

  // Remove platformatic from devDependencies
  if (packageJson.devDependencies?.platformatic) {
    delete packageJson.devDependencies.platformatic
    updated = true
  }

  // Fix start script if it's wrong
  let startScriptFixed = false
  if (!packageJson.scripts.start || packageJson.scripts.start !== 'watt start') {
    packageJson.scripts.start = 'watt start'
    startScriptFixed = true
    updated = true
  }

  if (updated || !exists) {
    await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8')
    return {
      updated: true,
      packageJsonPath,
      added: addedDeps,
      updatedVersions: updatedDeps,
      created: !exists,
      startScriptFixed
    }
  }

  return { updated: false, packageJsonPath, added: [], updatedVersions: [], created: false, startScriptFixed: false }
}
