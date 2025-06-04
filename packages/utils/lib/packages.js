'use strict'

const { glob } = require('glob')
const { join, dirname, resolve } = require('node:path')
const { readFile } = require('node:fs/promises')
const { isFileAccessible } = require('./is-file-accessible')
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

async function checkForDependencies (logger, args, require, config, modules) {
  const requiredDependencies = {}
  requiredDependencies.fastify = await getDependencyVersion(require, 'fastify')
  for (const m of modules) {
    if (m.startsWith('@platformatic')) {
      requiredDependencies[m] = await getPlatformaticVersion()
    } else {
      const externalModuleVersion = await getLatestNpmVersion(m)
      if (externalModuleVersion === null) {
        logger.error(`Cannot find latest version on npm for package ${m}`)
      } else {
        requiredDependencies[m] = externalModuleVersion
      }
    }
  }

  const packageJsonPath = resolve(process.cwd(), 'package.json')
  const isPackageJsonExists = await isFileAccessible(packageJsonPath)

  if (isPackageJsonExists) {
    const packageJsonFile = await readFile(packageJsonPath, 'utf-8')
    const packageJson = JSON.parse(packageJsonFile)

    let allRequiredDependenciesInstalled = true
    for (const dependencyName in requiredDependencies) {
      if (!hasDependency(packageJson, dependencyName)) {
        allRequiredDependenciesInstalled = false
        break
      }
    }
    if (allRequiredDependenciesInstalled) return /* c8 ignore next */
  }

  let command = 'npm i --save'

  /* c8 ignore next 3 */
  if (config.plugins?.typescript !== undefined) {
    command += ' @types/node'
  }
  for (const [depName, depVersion] of Object.entries(requiredDependencies)) {
    command += ` ${depName}@${depVersion}`
  }
  logger.warn(`Please run \`${command}\` to install types dependencies.`)
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
  return glob(`**/*.${globSuffix}`, { ...globOptions, cwd: root })
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
  checkForDependencies,
  getLatestNpmVersion,
  searchFilesWithExtensions,
  searchJavascriptFiles,
  detectApplicationType
}
