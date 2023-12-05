'use strict'

const { readFile } = require('node:fs/promises')
const { stripVersion, convertServiceNameToPrefix, addPrefixToEnv, extractEnvVariablesFromText } = require('./utils')
const { join } = require('node:path')
const { FileGenerator } = require('./file-generator')
const { generateTests, generatePlugins } = require('./create-plugin')
const { PrepareError, MissingEnvVariable, ModuleNeeded } = require('./errors')
const { generateGitignore } = require('./create-gitignore')
const generateName = require('boring-name-generator')
/* c8 ignore start */
const fakeLogger = {
  info: () => {},
  warn: () => {},
  debug: () => {},
  trace: () => {},
  error: () => {}
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
      staticWorkspaceGitHubActions: false,
      dynamicWorkspaceGitHubActions: false,
      isRuntimeContext: false,
      serviceName: '',
      envPrefix: '',
      env: {}
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
          this.config.env[field.var] = field.value
        }
        if (field.configValue) {
          this.config[field.configValue] = field.value
        }
      }
    }
  }

  getDefaultEnv () {
    return {}
  }

  setEnv (env) {
    if (this.config.isRuntimeContext) {
      this.config.env = addPrefixToEnv(this.config.env, this.config.envPrefix)
    } else {
      this.config.env = env
    }
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
      if (!this.config.serviceName) {
        this.config.serviceName = generateName().dashed
      }
      // set envPrefix
      if (this.config.serviceName && !this.config.envPrefix) {
        this.config.envPrefix = convertServiceNameToPrefix(this.config.serviceName)
      }

      // modify env
      this.config.env = addPrefixToEnv(this.config.env, this.config.envPrefix)
    }

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

  /* c8 ignore stop */
  appendConfigEnv () {
    const dotEnvFile = this.getFileObject('.env')
    let dotEnvFileContents = dotEnvFile.contents

    if (this.config.env) {
      Object.entries(this.config.env).forEach((kv) => {
        dotEnvFileContents += `${kv[0]}=${kv[1]}\n`
      })
      dotEnvFile.contents = dotEnvFileContents
    }
  }

  async prepare () {
    try {
      this.reset()
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

      if (this.config.typescript) {
        // create tsconfig.json
        this.addFile({
          path: '',
          file: 'tsconfig.json',
          contents: JSON.stringify(this.getTsConfig(), null, 2)
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
    const configFileName = 'platformatic.json'
    const fileOjbect = this.getFileObject(configFileName)
    const envVars = extractEnvVariablesFromText(fileOjbect.contents)
    const envKeys = Object.keys(this.config.env)
    if (envVars.length > 0) {
      envVars.forEach((ev) => {
        if (!envKeys.includes(ev)) {
          throw new MissingEnvVariable(ev, configFileName)
        }
      })
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
        outDir: 'dist'
      },
      watchOptions: {
        watchFile: 'fixedPollingInterval',
        watchDirectory: 'fixedPollingInterval',
        fallbackPolling: 'dynamicPriority',
        synchronousWatchDirectory: true,
        excludeDirectories: ['**/node_modules', 'dist']
      }
    }
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

      // typescript
      this.questions.push({
        type: 'list',
        name: 'typescript',
        message: 'Do you want to use TypeScript?',
        default: false,
        choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
      })

      // port
      this.questions.push({
        type: 'input',
        name: 'port',
        message: 'What port do you want to use?'
      })
    }
  }

  async generateConfigFile () {
    const configFileName = 'platformatic.json'
    const contents = await this._getConfigFileContents()
    this.addFile({
      path: '',
      file: configFileName,
      contents: JSON.stringify(contents, null, 2)
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
    this.platformaticVersion = stripVersion(pkgData.version)
  }

  async generatePackageJson () {
    const template = {
      scripts: {
        start: 'platformatic start',
        test: 'node --test test/**'
      },
      devDependencies: {
        fastify: `^${this.fastifyVersion}`,
        ...this.config.devDependencies
      },
      dependencies: {
        platformatic: `^${this.platformaticVersion}`,
        ...this.config.dependencies
      },
      engines: {
        node: '^18.8.0 || >=20.6.0'
      }
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
      // generate an empty .env file
      this.addFile({
        path: '',
        file: '.env',
        contents: ''
      })
      await this._generateEnv()
      this.appendConfigEnv()

      const { contents } = this.getFileObject('.env')
      this.addFile({
        path: '',
        file: '.env.sample',
        contents
      })
    }
  }

  async run () {
    const metadata = await this.prepare()
    await this.writeFiles()
    return metadata
  }

  addPackage (pkg) {
    this.packages.push(pkg)
    this.config.dependencies[pkg.name] = 'latest'
  }

  // implement in the subclass
  /* c8 ignore next 1 */
  async postInstallActions () {}
  async _beforePrepare () {}
  async _afterPrepare () {}
  async _getConfigFileContents () { return {} }
  async _generateEnv () {}
}

module.exports = BaseGenerator
module.exports.BaseGenerator = BaseGenerator
