import { join } from 'node:path'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileExists } from './utils.js'

async function getApplicationDependencies (config) {
  const { projectDir, runtime } = config

  const runtimeDependencies = { runtime: {}, services: {} }

  const runtimeConfig = runtime.getRuntimeConfig()
  const applications = runtimeConfig.applications || []

  await Promise.all(
    applications.map(async (application) => {
      const serviceDependencies = await getServiceDependencies(application.path)
      runtimeDependencies.services[application.id] = serviceDependencies
    })
  )

  runtimeDependencies.runtime = await getServiceDependencies(projectDir)
  return runtimeDependencies
}

async function getServiceDependencies (projectDir) {
  const packageJsonPath = join(projectDir, 'package.json')

  const packageJson = await parsePackageJson(packageJsonPath)
  if (packageJson === null) return { current: {}, dependencies: {} }

  const dependencies = packageJson.dependencies || {}
  const actualVersions = await getActualVersions(dependencies, projectDir)

  return { current: actualVersions, dependencies }
}

async function getActualVersions (dependencies, cwd) {
  const requireFromCwd = createRequire(join(cwd, 'dummy.js'))
  const actualVersions = {}

  await Promise.allSettled(
    Object.keys(dependencies).map(async (packageName) => {
      const packageJsonPath = requireFromCwd.resolve(`${packageName}/package.json`)
      const packageJson = await parsePackageJson(packageJsonPath)
      actualVersions[packageName] = packageJson ? packageJson.version : null
    })
  )

  return actualVersions
}

async function parsePackageJson (packageJsonPath, attempt = 1) {
  try {
    const packageJsonExists = await fileExists(packageJsonPath)
    if (!packageJsonExists) {
      throw new Error(`package.json not found in ${packageJsonPath}`)
    }

    const packageJsonFile = await readFile(packageJsonPath, 'utf8')
    const packageJson = JSON.parse(packageJsonFile)
    return packageJson
  } catch (error) {
    console.error('Error parsing package.json:', error.message)
    if (attempt < 3) {
      console.error(`Retrying... attempt ${attempt}`)
      await sleep(100)
      return parsePackageJson(packageJsonPath, attempt + 1)
    } else {
      console.error('Max attempts reached, returning null')
      return null
    }
  }
}

export default getApplicationDependencies
