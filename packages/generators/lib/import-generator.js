import { findConfigurationFileRecursive, safeRemove } from '@platformatic/foundation'
import { spawnSync } from 'node:child_process'
import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { BaseGenerator } from './base-generator.js'

export class ImportGenerator extends BaseGenerator {
  constructor (options = {}) {
    const { applicationName, module, version, parent: runtime, ...opts } = options
    super({ ...opts, module })

    this.runtime = runtime
    this.setConfig({
      applicationName,
      applicationPathEnvName: `PLT_APPLICATION_${applicationName.toUpperCase().replaceAll(/[^A-Z0-9_]/g, '_')}_PATH`,
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
    const { module: pkg, version } = this.config
    let path = this.config.applicationPath

    if (!isAbsolute(path)) {
      path = resolve(this.runtime.targetDirectory, this.config.applicationPath)
    }

    const packageJsonPath = join(path, 'package.json')

    if (this.config.operation === 'copy') {
      await this.#copy(path)
      await this.#generateConfigFile(path, '')
      await this.#updatePackageJson(packageJsonPath, 'package.json', pkg, version)
    } else {
      this.config.pnpmWorkspacePath = path

      await this.#detectGitUrl(path)
      await this.#generateConfigFile(path, path)

      await this.#updatePackageJson(packageJsonPath, packageJsonPath, pkg, version)
      await this.#updateRuntime(runtime)
    }
  }

  async _afterWriteFiles (runtime) {
    // No need for an empty folder in the applications folder
    if (this.config.operation === 'import') {
      await safeRemove(join(runtime.applicationsBasePath, this.config.applicationName))
    }
  }

  async #detectGitUrl (path) {
    let url

    // First of all, determine if there is a git repository in the application path
    // Detect if there is a git folder and eventually get the remote
    for (const candidate of ['origin', 'upstream']) {
      try {
        const result = spawnSync('git', ['remote', 'get-url', candidate], {
          cwd: path,
          env: { GIT_DIR: join(path, '.git') }
        })

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
    const existingConfig = await findConfigurationFileRecursive(originalPath)

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

    packageJson.version ??= '0.1.0'
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

    // Find which key is being used for the manual applications
    let key
    for (const candidate of new Set([runtime.applicationsFolder, 'applications', 'services', 'web'])) {
      if (Array.isArray(config[candidate])) {
        key = candidate
        break
      }
    }

    /* c8 ignore next - else */
    key ??= runtime.applicationsFolder ?? 'applications'
    const applications = config[key] ?? []

    if (!applications.some(application => application.id === this.config.applicationName)) {
      applications.push({
        id: this.config.applicationName,
        path: `{${this.config.applicationPathEnvName}}`,
        url: this.config.gitUrl
      })
    }

    config[key] = applications

    if (env.length > 0) {
      env += '\n'
    }
    env += `${this.config.applicationPathEnvName}=${this.config.applicationPath}`

    runtime.updateRuntimeConfig(config)
    runtime.updateRuntimeEnv(env)
  }

  async #copy (root) {
    const files = await readdir(root, { withFileTypes: true, recursive: true })

    for await (const file of files) {
      const absolutePath = resolve(file.parentPath, file.name)
      let path = relative(root, dirname(absolutePath))

      if (
        file.isDirectory() ||
        ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'].includes(file.name) ||
        path.includes('node_modules')
      ) {
        continue
      }

      /* c8 ignore next 6 */
      if (path === '.') {
        path = ''
      }

      this.addFile({
        path,
        file: file.name,
        contents: await readFile(resolve(file.parentPath, file.name))
      })
    }
  }
}
