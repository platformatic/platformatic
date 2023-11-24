'use strict'

const { readFile } = require('node:fs/promises')
const { stripVersion, convertServiceNameToPrefix, addPrefixToEnv, extractEnvVariablesFromText } = require('./utils')
const { join } = require('node:path')
const { FileGenerator } = require('./file-generator')
const { generateTests, generatePlugins } = require('./create-plugin')
const { NoQuestionsError, PrepareError, MissingEnvVariable } = require('./errors')
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
    this.type = opts.type
    this.files = []
    this.logger = opts.logger || fakeLogger
    this.questions = []
    this.pkgData = null
    this.inquirer = null
    this.targetDirectory = opts.targetDirectory || null
    this.config = this.getDefaultConfig()
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
    this.config = {
      ...this.getDefaultConfig(),
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
    if (!this.questions.length) {
      throw new NoQuestionsError()
    }
    if (this.inquirer) {
      this.config = await this.inquirer.prompt(this.questions)
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

      await this.prepareQuestions()

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
      }
      if (this.config.tests) {
        // create tests
        this.files.push(...generateTests(this.config.typescript, this.type))
      }

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
      throw new PrepareError(err.message)
    }
  }

  checkEnvVariablesInConfigFile () {
    const configFileName = this.getConfigFileName()
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
    // directory
    this.questions.push({
      type: 'input',
      name: 'targetDirectory',
      message: 'Where would you like to create your project?'
    })

    // typescript
    this.questions.push({
      type: 'list',
      name: 'typescript',
      message: 'Do you want to use TypeScript?',
      default: false,
      choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
    })

    // init git repository
    this.questions.push({
      type: 'list',
      name: 'initGitRepository',
      message: 'Do you want to init the git repository?',
      default: false,
      choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
    })

    // port
    this.questions.push({
      type: 'input',
      name: 'port',
      message: 'What port do you want to use?'
    })

    // github actions
    this.questions.push({
      type: 'list',
      name: 'staticWorkspaceGitHubAction',
      message: 'Do you want to create the github action to deploy this application to Platformatic Cloud?',
      default: true,
      choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
    },
    {
      type: 'list',
      name: 'dynamicWorkspaceGitHubAction',
      message: 'Do you want to enable PR Previews in your application?',
      default: true,
      choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
    })
  }

  async addQuestion (question, where) {
    if (where) {
      if (where.before) {
        const position = this.questions.reduce((acc, element, idx) => {
          if (acc === null) {
            if (element.name === where.before) {
              acc = idx
            }
          }
          return acc
        }, null)

        if (position) {
          this.questions.splice(position, 0, question)
        }
      } else if (where.after) {
        const position = this.questions.reduce((acc, element, idx) => {
          if (acc === null) {
            if (element.name === where.after) {
              acc = idx + 1
            }
          }
          return acc
        }, null)

        if (position) {
          this.questions.splice(position, 0, question)
        }
      }
    } else {
      this.questions.push(question)
    }
  }

  removeQuestion (variableName) {
    const position = this.questions.reduce((acc, element, idx) => {
      if (acc === null) {
        if (element.name === variableName) {
          acc = idx
        }
      }
      return acc
    }, null)
    if (position) {
      this.questions.splice(position, 1)
    }
  }

  getConfigFileName () {
    if (!this.type) {
      return 'platformatic.json'
    } else {
      return `platformatic.${this.type}.json`
    }
  }

  async generateConfigFile () {
    const configFileName = this.getConfigFileName()
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
    }
  }

  async run () {
    const metadata = await this.prepare()
    await this.writeFiles()
    return metadata
  }

  // implement in the subclass
  async _beforePrepare () {}
  async _afterPrepare () {}
  async _getConfigFileContents () { return {} }
  async _generateEnv () {}
}

module.exports = BaseGenerator
module.exports.BaseGenerator = BaseGenerator
