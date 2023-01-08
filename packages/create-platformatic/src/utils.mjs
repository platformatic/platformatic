import { execa } from 'execa'
import { request } from 'undici'
import { access, constants, readFile } from 'fs/promises'
import { resolve, join, dirname } from 'path'
import { createRequire } from 'module'

export const sleep = ms => new Promise((resolve) => setTimeout(resolve, ms))
export const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1) + min)

export async function isFileAccessible (filename, directory) {
  try {
    const filePath = directory ? resolve(directory, filename) : filename
    await access(filePath)
    return true
  } catch (err) {
    return false
  }
}

export const getUsername = async () => {
  const { stdout } = await execa('git', ['config', 'user.name'])
  if (stdout?.trim()) {
    return stdout.trim()
  }
  {
    const { stdout } = await execa('whoami')
    if (stdout?.trim()) {
      return stdout.trim()
    }
  }
  return null
}

export const getVersion = async () => {
  try {
    const { body, statusCode } = await request('https://registry.npmjs.org/platformatic/latest')
    if (statusCode !== 200) {
      return null
    }
    const { version } = await body.json()
    return version
  } catch (err) {
    return null
  }
}

export async function isDirectoryWriteable (directory) {
  try {
    await access(directory, constants.R_OK | constants.W_OK)
    return true
  } catch (err) {
    return false
  }
}

export const validatePath = async projectPath => {
  // if the folder exists, is OK:
  const projectDir = resolve(projectPath)
  const canAccess = await isDirectoryWriteable(projectDir)
  if (canAccess) {
    return true
  }
  // if the folder does not exist, check if the parent folder exists:
  const parentDir = dirname(projectDir)
  const canAccessParent = await isDirectoryWriteable(parentDir)
  if (canAccessParent) {
    return true
  }
  return false
}

const findConfigFile = async (directory, type) => {
  const configFileNames = [
    `platformatic.${type}.json`,
    `platformatic.${type}.json5`,
    `platformatic.${type}.yaml`,
    `platformatic.${type}.yml`,
    `platformatic.${type}.toml`,
    `platformatic.${type}.tml`
  ]
  const configFilesAccessibility = await Promise.all(configFileNames.map((fileName) => isFileAccessible(fileName, directory)))
  const accessibleConfigFilename = configFileNames.find((value, index) => configFilesAccessibility[index])
  return accessibleConfigFilename
}

export const findDBConfigFile = async (directory) => (findConfigFile(directory, 'db'))
export const findServiceConfigFile = async (directory) => (findConfigFile(directory, 'service'))

export const getDependencyVersion = async (dependencyName) => {
  const require = createRequire(import.meta.url)
  const pathToPackageJson = join(dirname(require.resolve(dependencyName)), 'package.json')
  const packageJsonFile = await readFile(pathToPackageJson, 'utf-8')
  const packageJson = JSON.parse(packageJsonFile)
  return packageJson.version
}

export const getSupportedNodeVersions = () => {
  return ['16.17.0', '18.8.0', '19.0.0']
}

export const isCurrentVersionSupported = (currentVersion) => {
  const supportedVersions = getSupportedNodeVersions()
  const getSemanticVersioning = (version) => {
    return {
      major: parseInt(version.split('.')[0], 10),
      minor: parseInt(version.split('.')[1], 10),
      patch: parseInt(version.split('.')[2], 10)
    }
  }
  const { major: currentMajor, minor: currentMinor, patch: currentPatch } = getSemanticVersioning(currentVersion)
  for (const version of supportedVersions) {
    const { major, minor, patch } = getSemanticVersioning(version)
    if (currentMajor > major) { continue }
    if (currentMajor < major || currentMinor < minor || currentPatch < patch) {
      return false
    }
    break
  }

  return true
}
