import { generateDashedName } from '@platformatic/foundation'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { generateGitignore } from './create-gitignore.js'
import { MissingEnvVariable, ModuleNeeded, PrepareError } from './errors.js'
import { FileGenerator } from './file-generator.js'
import {
  convertApplicationNameToPrefix,
  envStringToObject,
  extractEnvVariablesFromText,
  flattenObject,
  getApplicationTemplateFromSchemaUrl,
  getLatestNpmVersion,
  getPackageConfigurationObject,
  PLT_ROOT,
  stripVersion
} from './utils.js'

/* c8 ignore start */
const fakeLogger = {
  info: () => {},
  warn: () => {},
  debug: () => {},
  trace: () => {},
  error: () => {}
}
/* c8 ignore start */

const DEFAULT_SERVICES_PATH = 'applications'

class BaseGenerator extends FileGenerator {
  constructor (opts = {}) {
    super(opts)
    this.files = []
    this.logger = opts.logger || fakeLogger
    this.questions = []
    this.pkgData = null
    this.inquirer = opts.inquirer || null
    this.targetDirectory = opts.targetDirectory || null
    this.config = this.getDefaultConfig()
    this.packages = []
    this.module = opts.module
    this.runtime = null
    this.runtimeConfig = opts.runtimeConfig ?? 'platformatic.json'
    if (!this.module) {
      throw ModuleNeeded()
    }
  }

  setRuntime (runtime) {
    this.runtime = runtime
  }

  getDefaultConfig () {
    return {
      port: 3042,
      hostname: '0.0.0.0',
      plugin: false,
      tests: false,
      typescript: false,
      initGitRepository: false,
      dependencies: {},
      devDependencies: {},
      isRuntimeContext: false,
      applicationName: '',
      envPrefix: '',
      env: {},
      defaultEnv: {},
      isUpdating: false
    }
  }

  getConfigFieldsDefinitions () {
    return []
  }

  setConfigFields (fields) {
    const availableConfigFields = this.getConfigFieldsDefinitions()
    function shouldHandleConfigField (field) {
      return (
        availableConfigFields.filter(f => {
          return f.configValue === field.configValue && f.var === field.var
        }).length > 0
      )
    }
    for (const field of fields) {
      if (shouldHandleConfigField(field)) {
        if (field.var) {
          this.addEnvVar(field.var, field.value)
        }
        if (field.configValue) {
          this.config[field.configValue] = field.value
        }
      }
    }
  }

  getEnvVarName (envVarName) {
    const envVarPrefix = 'PLT_' + this.config.envPrefix + '_'
    if (this.config.isRuntimeContext && !envVarName.startsWith(envVarPrefix)) {
      if (envVarName.startsWith('PLT_')) {
        return envVarName.replace('PLT_', envVarPrefix)
      }
      return envVarPrefix + envVarName
    }
    return envVarName
  }

  addEnvVars (envVars, opts = {}) {
    for (const envVarName of Object.keys(envVars)) {
      const envVarValue = envVars[envVarName]
      this.addEnvVar(envVarName, envVarValue, opts)
    }
  }

  addEnvVar (envVarName, envVarValue, opts = {}) {
    opts.overwrite ??= true
    opts.default ??= false

    envVarName = this.getEnvVarName(envVarName)
    if (opts.overwrite || !this.config.env[envVarName]) {
      this.config.env[envVarName] = envVarValue
    }
    if ((opts.overwrite || !this.config.defaultEnv[envVarName]) && opts.default) {
      this.config.defaultEnv[envVarName] = envVarValue
    }
  }

  getEnvVar (envVarName) {
    envVarName = this.getEnvVarName(envVarName)
    return this.config.env[envVarName]
  }

  setEnvVars (envVars, opts) {
    this.config.env = {}
    this.config.defaultEnv = {}
    this.addEnvVars(envVars, opts)
  }

  setConfig (config) {
    if (!config) {
      this.config = this.getDefaultConfig()
    }
    const oldConfig = this.config
    this.config = {
      ...this.getDefaultConfig(),
      ...oldConfig,
      ...config
    }

    if (this.config.isRuntimeContext) {
      if (!this.config.applicationName) {
        this.config.applicationName = generateDashedName()
      }
      // set envPrefix
      if (this.config.applicationName && !this.config.envPrefix) {
        this.config.envPrefix = convertApplicationNameToPrefix(this.config.applicationName)
      }
    }
    this.setEnvVars(this.config.env)

    if (this.config.targetDirectory) {
      this.targetDirectory = this.config.targetDirectory
    }
  }

  /* c8 ignore start */
  async ask () {
    if (this.inquirer) {
      await this.prepareQuestions()
      const newConfig = await this.inquirer.prompt(this.questions)
      this.setConfig({
        ...this.config,
        ...newConfig
      })
    }
  }

  async prepare () {
    try {
      this.reset()

      if (this.config.isUpdating) {
        // only the packages options may have changed, let's update those
        await this.generateConfigFile()
        const generatedConfigFile = JSON.parse(this.getFileObject(this.runtimeConfig, '').contents)
        const fileFromDisk = await this.loadFile({ file: this.runtimeConfig, path: '' })
        const currentConfigFile = JSON.parse(fileFromDisk.contents)
        if (currentConfigFile.plugins) {
          if (generatedConfigFile.plugins && generatedConfigFile.plugins.packages) {
            currentConfigFile.plugins.packages = generatedConfigFile.plugins.packages
          } else {
            // remove packages because new configuration does not have them
            currentConfigFile.plugins.packages = []
          }
        }
        this.reset()
        this.addFile({
          path: '',
          file: this.runtimeConfig,
          contents: JSON.stringify(currentConfigFile, null, 2)
        })
      } else {
        await this.getFastifyVersion()
        await this.getPlatformaticVersion()

        await this._beforePrepare()

        // generate package.json
        const template = await this.generatePackageJson()
        this.addFile({
          path: '',
          file: 'package.json',
          contents: JSON.stringify(template, null, 2)
        })

        await this.generateConfigFile()

        await this.generateEnv()

        this.files.push(generateGitignore())

        await this._afterPrepare()

        this.checkEnvVariablesInConfigFile()
      }
      return {
        targetDirectory: this.targetDirectory,
        env: this.config.env
      }
    } catch (err) {
      if (err.code?.startsWith('PLT_GEN')) {
        // throw the same error
        throw err
      }
      const _err = new PrepareError(err.message)
      _err.cause = err
      throw _err
    }
  }

  checkEnvVariablesInConfigFile () {
    const excludedEnvs = [PLT_ROOT]
    const configFileName = this.runtimeConfig
    const fileObject = this.getFileObject(configFileName)
    const envVars = extractEnvVariablesFromText(fileObject.contents)
    const envKeys = Object.keys(this.config.env)
    if (envVars.length > 0) {
      for (const ev of envVars) {
        if (excludedEnvs.includes(ev)) {
          continue
        }
        if (!envKeys.includes(ev)) {
          throw new MissingEnvVariable(ev, configFileName)
        }
      }
    }

    return true
  }

  async prepareQuestions () {
    if (!this.config.isRuntimeContext) {
      if (!this.config.targetDirectory) {
        // directory
        this.questions.push({
          type: 'input',
          name: 'targetDirectory',
          message: 'Where would you like to create your project?'
        })
      }

      // port
      if (!this.config.skipPort) {
        this.questions.push({
          type: 'input',
          name: 'port',
          message: 'What port do you want to use?'
        })
      }
    }
  }

  async generateConfigFile () {
    const configFileName = this.runtimeConfig
    const contents = await this._getConfigFileContents()
    // handle packages
    if (this.packages.length > 0) {
      if (!contents.plugins) {
        contents.plugins = {}
      }
      contents.plugins.packages = this.packages.map(packageDefinition => {
        const packageConfigOutput = getPackageConfigurationObject(
          packageDefinition.options,
          this.config.applicationName
        )
        if (Object.keys(packageConfigOutput.env).length > 0) {
          const envForPackages = {}
          Object.entries(packageConfigOutput.env).forEach(kv => {
            envForPackages[kv[0]] = kv[1]
          })
          this.addEnvVars(envForPackages)
        }
        return {
          name: packageDefinition.name,
          options: packageConfigOutput.config
        }
      })
    }

    this.addFile({
      path: '',
      file: configFileName,
      contents: JSON.stringify(contents, null, 2)
    })

    return contents
  }

  /**
   * Reads the content of package.json and returns it as an object
   * @returns Object
   */
  async readPackageJsonFile () {
    if (this.pkgData) {
      return this.pkgData
    }
    const currentPackageJsonPath = join(import.meta.dirname, '..', 'package.json')
    this.pkgData = JSON.parse(await readFile(currentPackageJsonPath, 'utf8'))
    return this.pkgData
  }

  async getFastifyVersion () {
    const pkgData = await this.readPackageJsonFile()
    this.fastifyVersion = stripVersion(pkgData.dependencies.fastify)
  }

  async getPlatformaticVersion () {
    const pkgData = await this.readPackageJsonFile()
    this.platformaticVersion = pkgData.version
  }

  async generatePackageJson () {
    const template = {
      name: `${this.config.applicationName}`,
      scripts: {
        start: 'platformatic start',
        test: 'node --test'
      },
      devDependencies: {
        fastify: `^${this.fastifyVersion}`,
        ...this.config.devDependencies
      },
      dependencies: {
        ...this.config.dependencies
      },
      engines: {
        node: '>=22.18.0'
      }
    }

    if (this.config.typescript) {
      const typescriptVersion = JSON.parse(await readFile(join(import.meta.dirname, '..', 'package.json'), 'utf-8'))
        .devDependencies.typescript
      template.devDependencies.typescript = typescriptVersion
    }
    return template
  }

  async generateEnv () {
    if (this.config.isRuntimeContext) {
      return
    }

    const serializedEnv = serializeEnvVars(this.config.env)

    this.addFile({
      path: '',
      file: '.env',
      contents: serializedEnv
    })

    const emptyEnvVars = {}
    for (const envVarName of Object.keys(this.config.env)) {
      if (!this.config.defaultEnv[envVarName]) {
        emptyEnvVars[envVarName] = ''
      }
    }

    this.addFile({
      path: '',
      file: '.env.sample',
      contents: serializeEnvVars({
        ...this.config.defaultEnv,
        ...emptyEnvVars
      })
    })

    return serializedEnv
  }

  async run () {
    const metadata = await this.prepare()
    await this.writeFiles()
    return metadata
  }

  async addPackage (pkg) {
    this.config.dependencies[pkg.name] = 'latest'
    try {
      const version = await getLatestNpmVersion(pkg.name)
      if (version) {
        this.config.dependencies[pkg.name] = version
      }
    } catch (err) {
      this.logger.warn(`Could not get latest version for ${pkg.name}, setting it to latest`)
    }
    this.packages.push(pkg)
  }

  async loadFromDir (applicationName, runtimeRootPath) {
    const runtimePkgConfigFileData = JSON.parse(await readFile(join(runtimeRootPath, this.runtimeConfig), 'utf-8'))
    const applicationsPath = runtimePkgConfigFileData.autoload?.path ?? DEFAULT_SERVICES_PATH
    const applicationPkgJsonFileData = JSON.parse(
      await readFile(join(runtimeRootPath, applicationsPath, applicationName, 'platformatic.json'), 'utf-8')
    )
    const runtimeEnv = envStringToObject(await readFile(join(runtimeRootPath, '.env'), 'utf-8'))
    const applicationNamePrefix = convertApplicationNameToPrefix(applicationName)
    const plugins = []
    if (applicationPkgJsonFileData.plugins && applicationPkgJsonFileData.plugins.packages) {
      for (const pkg of applicationPkgJsonFileData.plugins.packages) {
        const flattened = flattenObject(pkg)
        const output = {
          name: flattened.name,
          options: []
        }
        if (pkg.options) {
          Object.entries(flattened)
            .filter(([key, value]) => key.indexOf('options.') === 0 && flattened[key].startsWith('{PLT_'))
            .forEach(([key, value]) => {
              const runtimeEnvVarKey = value.replace(/[{}]/g, '')
              const applicationEnvVarKey = runtimeEnvVarKey.replace(`PLT_${applicationNamePrefix}_`, '')
              const option = {
                name: applicationEnvVarKey,
                path: key.replace('options.', ''),
                type: 'string',
                value: runtimeEnv[runtimeEnvVarKey]
              }
              output.options.push(option)
            })
        }

        plugins.push(output)
      }
    }

    return {
      name: applicationName,
      template: getApplicationTemplateFromSchemaUrl(applicationPkgJsonFileData.$schema),
      fields: [],
      plugins
    }
  }

  // implement in the subclass
  /* c8 ignore next 1 */
  async postInstallActions () {}
  async _beforePrepare () {}
  async _afterPrepare () {}
  async _getConfigFileContents () {
    return {}
  }
}

function serializeEnvVars (envVars) {
  let envVarsString = ''
  for (const envVarName of Object.keys(envVars)) {
    const envVarValue = envVars[envVarName]
    envVarsString += `${envVarName}=${envVarValue}\n`
  }
  return envVarsString
}

export default BaseGenerator
const _BaseGenerator = BaseGenerator
export { _BaseGenerator as BaseGenerator }
