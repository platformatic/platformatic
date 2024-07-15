import { execa } from 'execa'
import { access, constants, mkdir, readFile } from 'fs/promises'
import { resolve, join, dirname } from 'path'
import { createRequire } from 'module'
import semver from 'semver'
import * as desm from 'desm'
import * as url from 'url'

import ConfigManager from '@platformatic/config'

export const sleep = ms => new Promise((resolve) => setTimeout(resolve, ms))
export const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1) + min)
const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

export async function isFileAccessible (filename, directory) {
  try {
    const filePath = directory ? resolve(directory, filename) : filename
    await access(filePath)
    return true
  } catch (err) {
    return false
  }
}
/**
 * Gets the username from git config or `whoami` command
 * @returns string | null
 */
export const getUsername = async () => {
  try {
    const { stdout } = await execa('git', ['config', 'user.name'])
    if (stdout?.trim()) {
      return stdout.trim()
    }
  } catch (err) {
  // ignore: git failed
  }
  try {
    const { stdout } = await execa('whoami')
    if (stdout?.trim()) {
      return stdout.trim()
    }
  } catch (err) {
  // ignore: whoami failed
  }

  return null
}
/**
 * Get the platformatic package version from package.json
 * @returns string
 */
/* c8 ignore next 4 */
export const getVersion = async () => {
  const data = await readFile(desm.join(import.meta.url, '..', 'package.json'), 'utf8')
  return JSON.parse(data).version
}

export async function isDirectoryWriteable (directory) {
  try {
    await access(directory, constants.R_OK | constants.W_OK)
    return true
  } catch (err) {
    return false
  }
}

export const findConfigFile = async (directory) => (ConfigManager.findConfigFile(directory))
export const findDBConfigFile = async (directory) => (ConfigManager.findConfigFile(directory, 'db'))
export const findServiceConfigFile = async (directory) => (ConfigManager.findConfigFile(directory, 'service'))
export const findComposerConfigFile = async (directory) => (ConfigManager.findConfigFile(directory, 'composer'))
export const findRuntimeConfigFile = async (directory) => (ConfigManager.findConfigFile(directory, 'runtime'))

/**
 * Gets the version of the specified dependency package from package.json
 * @param {string} dependencyName
 * @returns string
 */
export const getDependencyVersion = async (dependencyName) => {
  const rootPackageJson = join(__dirname, '..', 'package.json')
  const packageJsonContents = JSON.parse(await readFile(rootPackageJson, 'utf8'))
  const dependencies = packageJsonContents.dependencies
  const devDependencies = packageJsonContents.devDependencies
  const regexp = /(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)/
  if (dependencies[dependencyName]) {
    const match = dependencies[dependencyName].match(regexp)
    if (!match) {
      return await resolveWorkspaceDependency(dependencyName)
    }
    return match[0]
  }

  if (devDependencies[dependencyName]) {
    const match = devDependencies[dependencyName].match(regexp)
    if (!match) {
      return await resolveWorkspaceDependency(dependencyName)
    }
    return match[0]
  }

  async function resolveWorkspaceDependency (dependencyName) {
    const require = createRequire(import.meta.url)
    let dependencyPath = dirname(require.resolve(dependencyName))
    // some deps are resolved not at their root level
    // for instance 'typescript' will be risolved in its own ./lib directory
    // next loop is to find the nearest parent directory that contains a package.json file
    while (!await isFileAccessible(join(dependencyPath, 'package.json'))) {
      dependencyPath = join(dependencyPath, '..')
      if (dependencyPath === '/') {
        throw new Error(`Cannot find package.json for ${dependencyName}`)
      }
    }
    const pathToPackageJson = join(dependencyPath, 'package.json')
    const packageJsonFile = await readFile(pathToPackageJson, 'utf-8')
    const packageJson = JSON.parse(packageJsonFile)
    return packageJson.version
  }
}

export const minimumSupportedNodeVersions = ['18.8.0', '20.6.0']

export const isCurrentVersionSupported = (currentVersion) => {
  // TODO: add try/catch if some unsupported node version is passed
  for (const version of minimumSupportedNodeVersions) {
    if (semver.major(currentVersion) === semver.major(version) && semver.gte(currentVersion, version)) {
      return true
    }
  }
  return false
}

export function convertServiceNameToPrefix (serviceName) {
  return serviceName.replace(/-/g, '_').toUpperCase()
}
export function addPrefixToEnv (env, prefix) {
  const output = {}
  Object.entries(env).forEach(([key, value]) => {
    output[`${prefix}_${key}`] = value
  })
  return output
}

export async function safeMkdir (dir) {
  try {
    await mkdir(dir, { recursive: true })
  } catch (err) {
    // do nothing
  }
}
