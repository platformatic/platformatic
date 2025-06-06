'use strict'

const { findConfigurationFile } = require('@platformatic/config')
const { safeRemove } = require('@platformatic/utils')
const { glob } = require('glob')
const { BaseGenerator } = require('./base-generator')
const { spawnSync } = require('node:child_process')
const { stat, readFile } = require('node:fs/promises')
const { join, dirname } = require('node:path')

class ImportGenerator extends BaseGenerator {
  constructor (options = {}) {
    const { serviceName, module, version, parent: runtime, ...opts } = options
    super({ ...opts, module })

    this.runtime = runtime
    this.setConfig({
      serviceName,
      servicePathEnvName: `PLT_SERVICE_${serviceName.toUpperCase().replaceAll(/[^A-Z0-9_]/g, '_')}_PATH`,
      module,
      version
    })
  }

  async prepareQuestions () {
    await super.prepareQuestions()

    this.questions.push({
      type: 'input',
      name: 'applicationPath',
      message: 'Where is your application located?',
      async validate (value) {
        if (value.length === 0) {
          return 'Please enter a path'
        }

        try {
          const pathStat = await stat(value)

          if (!pathStat?.isDirectory()) {
            return 'Please enter a valid path'
          }
        } catch {
          return 'Please enter a valid path'
        }

        return true
      }
    })

    this.questions.push({
      type: 'list',
      name: 'operation',
      message: 'Do you want to import or copy your application?',
      default: 'import',
      choices: [
        { name: 'import', value: 'import' },
        { name: 'copy', value: 'copy' }
      ]
    })
  }

  // We can't use prepare as it is not invoked from the runtime when dealing with existing applications
  /* c8 ignore next 3 - Invoked from base-generator */
  async prepare () {
    return { targetDirectory: this.targetDirectory, env: this.config.env }
  }

  async _beforeWriteFiles (runtime) {
    const { module: pkg, version, applicationPath: path } = this.config

    const packageJsonPath = join(path, 'package.json')

    if (this.config.operation === 'copy') {
      await this.#copy(path)
      await this.#generateConfigFile(path, '')
      await this.#updatePackageJson(packageJsonPath, 'package.json', pkg, version)
    } else {
      await this.#detectGitUrl(path)
      await this.#generateConfigFile(path, path)

      await this.#updatePackageJson(packageJsonPath, packageJsonPath, pkg, version)
      await this.#updateRuntime(runtime)
    }
  }

  async _afterWriteFiles (runtime) {
    // No need for an empty folder in the services folder
    if (this.config.operation === 'import') {
      await safeRemove(join(runtime.servicesBasePath, this.config.serviceName))
    }
  }

  async #detectGitUrl (path) {
    let url

    // First of all, determine if there is a git repository in the application path
    // Detect if there is a git folder and eventually get the remote
    for (const candidate of ['origin', 'upstream']) {
      try {
        const result = spawnSync('git', ['remote', 'get-url', candidate], { cwd: path })

        /* c8 ignore next 3 - Hard to test */
        if (result.error || result.status !== 0) {
          continue
        }

        url = result.stdout.toString().trim()
        break
        /* c8 ignore next 3 - Hard to test */
      } catch (e) {
        // No-op
      }
    }

    this.setConfig({ gitUrl: url })
    return url
  }

  async #generateConfigFile (originalPath, updatedPath) {
    // Determine if there is a watt.json file in the application path - If it's missing, insert one
    // For import it means we don't update  the file, for copy it means it was already copied in #copy.
    const existingConfig = await findConfigurationFile(originalPath)

    if (existingConfig) {
      return
    }

    const { module: pkg, version } = this.config

    if (pkg.startsWith('@platformatic/')) {
      this.addFile({
        path: '',
        file: join(updatedPath, this.runtimeConfig),
        contents: JSON.stringify({ $schema: `https://schemas.platformatic.dev/${pkg}/${version}.json` }, null, 2)
      })
    } else {
      this.addFile({
        path: '',
        file: join(updatedPath, this.runtimeConfig),
        contents: JSON.stringify({ module: pkg }, null, 2)
      })
    }
  }

  async #updatePackageJson (originalPath, updatedPath, pkg, version) {
    // Add the module to the package.json dependencies
    let packageJson = {}

    try {
      packageJson = JSON.parse(await readFile(originalPath, 'utf-8'))
    } catch (e) {
      // No-op, we will create a new package.json
    }

    packageJson.dependencies ??= {}
    packageJson.dependencies[pkg] = `^${version}`
    if (packageJson.devDependencies?.[pkg]) {
      packageJson.devDependencies[pkg] = undefined
    }

    this.addFile({ path: '', file: updatedPath, contents: JSON.stringify(packageJson, null, 2) })
  }

  async #updateRuntime (runtime) {
    const configObject = runtime.getRuntimeConfigFileObject()
    /* c8 ignore next - else */
    const config = JSON.parse(configObject?.contents ?? '{}')
    const envObject = runtime.getRuntimeEnvFileObject()
    /* c8 ignore next - else */
    let env = envObject?.contents ?? ''

    // Find which key is being used for the manual services
    let key
    for (const candidate of new Set([runtime.servicesFolder, 'web', 'services'])) {
      if (Array.isArray(config[candidate])) {
        key = candidate
        break
      }
    }

    /* c8 ignore next - else */
    key ??= runtime.servicesFolder ?? 'services'
    const services = config[key] ?? []

    if (!services.some(service => service.id === this.config.serviceName)) {
      services.push({
        id: this.config.serviceName,
        path: `{${this.config.servicePathEnvName}}`,
        url: this.config.gitUrl
      })
    }

    config[key] = services

    if (env.length > 0) {
      env += '\n'
    }
    env += `${this.config.servicePathEnvName}=${this.config.applicationPath}`

    runtime.updateRuntimeConfig(config)
    runtime.updateRuntimeEnv(env)
  }

  async #copy (root) {
    const files = await glob('**/*', {
      cwd: root,
      dot: true,
      ignore: ['node_modules/**', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'],
      withFileTypes: true
    })

    for (const file of files) {
      if (file.isDirectory()) {
        continue
      }

      /* c8 ignore next 6 */
      let path = dirname(file.relative())
      if (path === '.') {
        path = ''
      } else if (path.startsWith('./')) {
        path = path.substring(2)
      }

      this.addFile({
        path,
        file: file.name,
        contents: await readFile(file.fullpath())
      })
    }
  }
}

module.exports = { ImportGenerator }
