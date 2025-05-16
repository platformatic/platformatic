'use strict'

const { generateDashedName } = require('@platformatic/utils')
const { readFile } = require('node:fs/promises')
const {
  convertServiceNameToPrefix,
  extractEnvVariablesFromText,
  getPackageConfigurationObject,
  PLT_ROOT,
  getLatestNpmVersion,
  stripVersion,
} = require('./utils')
const { join } = require('node:path')
const { FileGenerator } = require('./file-generator')
const { generateTests, generatePlugins } = require('./create-plugin')
const { PrepareError, MissingEnvVariable, ModuleNeeded } = require('./errors')
const { generateGitignore } = require('./create-gitignore')
const { getServiceTemplateFromSchemaUrl } = require('./utils')
const { flattenObject } = require('./utils')
const { envStringToObject } = require('./utils')
/* c8 ignore start */
const fakeLogger = {
  info: () => { },
  warn: () => { },
  debug: () => { },
  trace: () => { },
  error: () => { },
}
/* c8 ignore start */

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
    this.runtimeConfig = opts.runtimeConfig ?? 'platformatic.json'
    if (!this.module) {
      throw ModuleNeeded()
    }
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
      serviceName: '',
      envPrefix: '',
      env: {},
      defaultEnv: {},
      isUpdating: false,
    }
  }

  getConfigFieldsDefinitions () {
    return []
  }

  setConfigFields (fields) {
    const availableConfigFields = this.getConfigFieldsDefinitions()
    function shouldHandleConfigField (field) {
      return availableConfigFields.filter((f) => {
        return f.configValue === field.configValue && f.var === field.var
      }).length > 0
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
      ...config,
    }

    if (this.config.isRuntimeContext) {
      if (!this.config.serviceName) {
        this.config.serviceName = generateDashedName()
      }
      // set envPrefix
      if (this.config.serviceName && !this.config.envPrefix) {
        this.config.envPrefix = convertServiceNameToPrefix(this.config.serviceName)
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
        ...newConfig,
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
          contents: JSON.stringify(currentConfigFile, null, 2),
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
          contents: JSON.stringify(template, null, 2),
        })

        await this.generateConfigFile()

        await this.generateEnv()

        if (this.config.typescript) {
          // create tsconfig.json
          this.addFile({
            path: '',
            file: 'tsconfig.json',
            contents: JSON.stringify(this.getTsConfig(), null, 2),
          })
        }

        if (this.config.plugin) {
          // create plugin
          this.files.push(...generatePlugins(this.config.typescript))
          if (this.config.tests) {
            // create tests
            this.files.push(...generateTests(this.config.typescript, this.module))
          }
        }

        this.files.push(generateGitignore())

        await this._afterPrepare()

        this.checkEnvVariablesInConfigFile()
      }
      return {
        targetDirectory: this.targetDirectory,
        env: this.config.env,
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

  getTsConfig () {
    return {
      compilerOptions: {
        module: 'commonjs',
        esModuleInterop: true,
        target: 'es2020',
        sourceMap: true,
        pretty: true,
        noEmitOnError: true,
        incremental: true,
        strict: true,
        outDir: 'dist',
        skipLibCheck: true,
      },
      watchOptions: {
        watchFile: 'fixedPollingInterval',
        watchDirectory: 'fixedPollingInterval',
        fallbackPolling: 'dynamicPriority',
        synchronousWatchDirectory: true,
        excludeDirectories: ['**/node_modules', 'dist'],
      },
    }
  }

  async prepareQuestions () {
    if (!this.config.isRuntimeContext) {
      if (!this.config.targetDirectory) {
        // directory
        this.questions.push({
          type: 'input',
          name: 'targetDirectory',
          message: 'Where would you like to create your project?',
        })
      }

      // typescript
      this.questions.push({
        type: 'list',
        name: 'typescript',
        message: 'Do you want to use TypeScript?',
        default: false,
        choices: [{ name: 'yes', value: true }, { name: 'no', value: false }],
      })

      // port
      this.questions.push({
        type: 'input',
        name: 'port',
        message: 'What port do you want to use?',
      })
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
      contents.plugins.packages = this.packages.map((packageDefinition) => {
        const packageConfigOutput = getPackageConfigurationObject(packageDefinition.options, this.config.serviceName)
        if (Object.keys(packageConfigOutput.env).length > 0) {
          const envForPackages = {}
          Object.entries(packageConfigOutput.env).forEach((kv) => {
            envForPackages[kv[0]] = kv[1]
          })
          this.addEnvVars(envForPackages)
        }
        return {
          name: packageDefinition.name,
          options: packageConfigOutput.config,
        }
      })
    }

    this.addFile({
      path: '',
      file: configFileName,
      contents: JSON.stringify(contents, null, 2),
    })
  }

  /**
   * Reads the content of package.json and returns it as an object
   * @returns Object
   */
  async readPackageJsonFile () {
    if (this.pkgData) {
      return this.pkgData
    }
    const currentPackageJsonPath = join(__dirname, '..', 'package.json')
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
      name: `${this.config.serviceName}`,
      scripts: {
        start: 'platformatic start',
        test: 'borp',
      },
      devDependencies: {
        fastify: `^${this.fastifyVersion}`,
        borp: `${this.pkgData.devDependencies.borp}`,
        ...this.config.devDependencies,
      },
      dependencies: {
        ...this.config.dependencies,
      },
      engines: {
        node: '^22.14.0 || ^20.6.0',
      },
    }

    if (this.config.typescript) {
      const typescriptVersion = JSON.parse(await readFile(join(__dirname, '..', 'package.json'), 'utf-8')).devDependencies.typescript
      template.scripts.clean = 'rm -fr ./dist'
      template.scripts.build = 'platformatic compile'
      template.devDependencies.typescript = typescriptVersion
    }
    return template
  }

  async generateEnv () {
    if (!this.config.isRuntimeContext) {
      this.addFile({
        path: '',
        file: '.env',
        contents: serializeEnvVars(this.config.env),
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
          ...emptyEnvVars,
        }),
      })
    }
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

  async loadFromDir (serviceName, runtimeRootPath) {
    const runtimePkgConfigFileData = JSON.parse(await readFile(join(runtimeRootPath, this.runtimeConfig), 'utf-8'))
    const servicesPath = runtimePkgConfigFileData.autoload.path
    const servicePkgJsonFileData = JSON.parse(await readFile(join(runtimeRootPath, servicesPath, serviceName, 'platformatic.json'), 'utf-8'))
    const runtimeEnv = envStringToObject(await readFile(join(runtimeRootPath, '.env'), 'utf-8'))
    const serviceNamePrefix = convertServiceNameToPrefix(serviceName)
    const plugins = []
    if (servicePkgJsonFileData.plugins && servicePkgJsonFileData.plugins.packages) {
      for (const pkg of servicePkgJsonFileData.plugins.packages) {
        const flattened = flattenObject(pkg)
        const output = {
          name: flattened.name,
          options: [],
        }
        if (pkg.options) {
          Object.entries(flattened)
            .filter(([key, value]) => key.indexOf('options.') === 0 && flattened[key].startsWith('{PLT_'))
            .forEach(([key, value]) => {
              const runtimeEnvVarKey = value.replace(/[{}]/g, '')
              const serviceEnvVarKey = runtimeEnvVarKey.replace(`PLT_${serviceNamePrefix}_`, '')
              const option = {
                name: serviceEnvVarKey,
                path: key.replace('options.', ''),
                type: 'string',
                value: runtimeEnv[runtimeEnvVarKey],
              }
              output.options.push(option)
            })
        }

        plugins.push(output)
      }
    }

    return {
      name: serviceName,
      template: getServiceTemplateFromSchemaUrl(servicePkgJsonFileData.$schema),
      fields: [],
      plugins,
    }
  }

  // implement in the subclass
  /* c8 ignore next 1 */
  async postInstallActions () { }
  async _beforePrepare () { }
  async _afterPrepare () { }
  async _getConfigFileContents () { return {} }
}

function serializeEnvVars (envVars) {
  let envVarsString = ''
  for (const envVarName of Object.keys(envVars)) {
    const envVarValue = envVars[envVarName]
    envVarsString += `${envVarName}=${envVarValue}\n`
  }
  return envVarsString
}

module.exports = BaseGenerator
module.exports.BaseGenerator = BaseGenerator
