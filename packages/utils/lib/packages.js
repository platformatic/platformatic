'use strict'

const { join, dirname, resolve } = require('node:path')
const { readFile } = require('node:fs/promises')
const isFileAccessible = require('./is-file-accessible')
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

function hasDependency (packageJson, dependencyName) {
  const dependencies = packageJson.dependencies || {}
  const devDependencies = packageJson.devDependencies || {}

  return dependencies[dependencyName] !== undefined ||
    devDependencies[dependencyName] !== undefined
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

module.exports = {
  getDependencyVersion,
  getPlatformaticVersion,
  hasDependency,
  checkForDependencies,
  getLatestNpmVersion
}
