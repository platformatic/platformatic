import { findConfigurationFile } from '@platformatic/foundation'
import { execa } from 'execa'
import { access, constants, readFile } from 'fs/promises'
import { createRequire } from 'module'
import { dirname, join, resolve } from 'path'
import * as url from 'url'

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
export const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1) + min)
const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

const ansiCodes = {
  // Platformatic Green: #21FA90
  pltGreen: '\u001B[38;2;33;250;144m',
  bell: '\u0007',
  reset: '\u001b[0m',
  erasePreviousLine: '\u001b[1K'
}

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
  const data = await readFile(join(import.meta.dirname, '..', 'package.json'), 'utf8')
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

export const findConfigFile = async directory => findConfigurationFile(directory)
export const findDBConfigFile = async directory => findConfigurationFile(directory, 'db')
export const findServiceConfigFile = async directory => findConfigurationFile(directory, 'service')
export const findComposerConfigFile = async directory => findConfigurationFile(directory, 'composer')
export const findRuntimeConfigFile = async directory => findConfigurationFile(directory, 'runtime')

/**
 * Gets the version of the specified dependency package from package.json
 * @param {string} dependencyName
 * @returns string
 */
export const getDependencyVersion = async dependencyName => {
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
    while (!(await isFileAccessible(join(dependencyPath, 'package.json')))) {
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

export async function say (message) {
  // Disable if not supporting colors
  if (process.env.NO_COLOR) {
    console.log(message)
    return
  }

  const words = message.split(' ')

  for (let i = 0; i <= words.length; i++) {
    if (i > 0) {
      process.stdout.write('\r' + ansiCodes.erasePreviousLine)
    }

    process.stdout.write(ansiCodes.pltGreen + words.slice(0, i).join(' ') + ansiCodes.reset + ansiCodes.bell)
    await sleep(randomBetween(75, 100))
  }

  process.stdout.write('\n')
  await sleep(randomBetween(75, 200))
}
