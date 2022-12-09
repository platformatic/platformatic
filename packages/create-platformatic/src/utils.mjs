import { execa } from 'execa'
import { request } from 'undici'
import { existsSync, statSync, readdirSync, readFileSync } from 'node:fs'
import { access } from 'fs/promises'
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

export const validatePath = async projectPath => {
  const projectDir = resolve(process.cwd(), projectPath)
  if (existsSync(projectDir) && statSync(projectDir).isDirectory() && readdirSync(projectDir).length > 0) {
    throw Error('Please, specify an empty directory or create a new one.')
  }
  return true
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
  const packageJsonFile = readFileSync(pathToPackageJson, 'utf-8')
  const packageJson = JSON.parse(packageJsonFile)
  return packageJson.version
}
