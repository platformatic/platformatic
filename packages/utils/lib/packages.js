'use strict'

const { join, dirname, resolve } = require('node:path')
const { readFile, glob } = require('node:fs/promises')
const { request } = require('undici')

async function getDependencyVersion (require, dependencyName) {
  const pathToPackageJson = join(dirname(require.resolve(dependencyName)), 'package.json')
  const packageJsonFile = await readFile(pathToPackageJson, 'utf-8')
  const packageJson = JSON.parse(packageJsonFile)
  return packageJson.version
}

let platformaticPackageVersion

function getPlatformaticVersion () {
  if (platformaticPackageVersion) return platformaticPackageVersion
  return _getPlatformaticVersion()
}

async function _getPlatformaticVersion () {
  const pathToPackageJson = join(__dirname, '..', 'package.json')
  const packageJsonFile = await readFile(pathToPackageJson, 'utf-8')
  const packageJson = JSON.parse(packageJsonFile)
  platformaticPackageVersion = packageJson.version
  return platformaticPackageVersion
}

function hasDependency (packageJson, dependency) {
  return packageJson.dependencies?.[dependency] || packageJson.devDependencies?.[dependency]
}

async function getLatestNpmVersion (pkg) {
  const res = await request(`https://registry.npmjs.org/${pkg}`)
  if (res.statusCode === 200) {
    const json = await res.body.json()
    return json['dist-tags'].latest
  }
  return null
}

async function searchFilesWithExtensions (root, extensions, globOptions = {}) {
  const globSuffix = Array.isArray(extensions) ? `{${extensions.join(',')}}` : extensions
  return Array.fromAsync(glob(`**/*.${globSuffix}`, { ...globOptions, cwd: root }))
}

async function searchJavascriptFiles (projectDir, globOptions = {}) {
  return searchFilesWithExtensions(projectDir, ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts'], {
    ...globOptions,
    ignore: ['node_modules', '**/node_modules/**']
  })
}

async function hasFilesWithExtensions (root, extensions, globOptions = {}) {
  const files = await searchFilesWithExtensions(root, extensions, globOptions)
  return files.length > 0
}

async function hasJavascriptFiles (projectDir, globOptions = {}) {
  const files = await searchJavascriptFiles(projectDir, globOptions)
  return files.length > 0
}

async function detectApplicationType (root, packageJson) {
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

module.exports = {
  getDependencyVersion,
  getPlatformaticVersion,
  hasDependency,
  hasFilesWithExtensions,
  hasJavascriptFiles,
  getLatestNpmVersion,
  searchFilesWithExtensions,
  searchJavascriptFiles,
  detectApplicationType
}
