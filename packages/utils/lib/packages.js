'use strict'

const { join, dirname, resolve } = require('node:path')
const { readFile } = require('node:fs/promises')
const isFileAccessible = require('./is-file-accessible')

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
    requiredDependencies[m] = await getPlatformaticVersion()
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

    if (allRequiredDependenciesInstalled) return
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

module.exports.getDependencyVersion = getDependencyVersion
module.exports.getPlatformaticVersion = getPlatformaticVersion
module.exports.hasDependency = hasDependency
module.exports.checkForDependencies = checkForDependencies
