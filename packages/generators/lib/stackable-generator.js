'use strict'

const { join } = require('node:path')
const { readFile } = require('node:fs/promises')
const { stripVersion, getLatestNpmVersion } = require('./utils')
const { FileGenerator } = require('./file-generator')
const { PrepareError } = require('./errors')
const { generateGitignore } = require('./create-gitignore')
const { generateStackableCli } = require('./create-stackable-cli')
const { generateStackableFiles } = require('./create-stackable-files')
const { generateStackablePlugins } = require('./create-stackable-plugin')

/* c8 ignore start */
const fakeLogger = {
  info: () => {},
  warn: () => {},
  debug: () => {},
  trace: () => {},
  error: () => {}
}
/* c8 ignore start */

class StackableGenerator extends FileGenerator {
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
  }

  getDefaultConfig () {
    return {
      typescript: false,
      initGitRepository: false,
      dependencies: {},
      devDependencies: {}
    }
  }

  setConfigFields (fields) {
    for (const field of fields) {
      this.config[field.configValue] = field.value
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

      if (this.config.typescript) {
        // create tsconfig.json
        this.addFile({
          path: '',
          file: 'tsconfig.json',
          contents: JSON.stringify(this.getTsConfig(), null, 2)
        })
      }

      const typescript = this.config.typescript
      this.files.push(...generateStackableFiles(typescript))
      this.files.push(...generateStackableCli(typescript))
      this.files.push(...generateStackablePlugins(typescript))
      this.files.push(generateGitignore())

      await this._afterPrepare()

      return {
        targetDirectory: this.targetDirectory
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
    if (!this.config.targetDirectory) {
      // directory
      this.questions.push({
        type: 'input',
        name: 'targetDirectory',
        message: 'Where would you like to create your project?',
        default: 'platformatic'
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
    const dependencies = {
      '@platformatic/config': `^${this.platformaticVersion}`,
      '@platformatic/service': `^${this.platformaticVersion}`,
      'json-schema-to-typescript': '^13.0.0',
      pino: '^8.0.0',
      'pino-pretty': '^10.0.0',
      minimist: '^1.2.0',
      platformatic: `^${this.platformaticVersion}`
    }

    const devDependencies = {
      fastify: `^${this.fastifyVersion}`
    }

    if (this.config.typescript) {
      const packageJsonFile = await readFile(join(__dirname, '..', 'package.json'), 'utf-8')
      const typescriptVersion = JSON.parse(packageJsonFile).devDependencies.typescript

      return {
        main: 'dist/index.js',
        scripts: {
          build: 'tsc --build',
          'build:config': 'node ./dist/lib/schema.js | json2ts > config.d.ts',
          clean: 'rm -fr ./dist',
          create: 'node ./dist/cli/create.js --dir ./app',
          start: 'node ./dist/cli/start.js -c ./app/platformatic.json'
        },
        devDependencies: {
          ...devDependencies,
          '@types/minimist': '^1.2.5',
          typescript: typescriptVersion,
          ...this.config.devDependencies
        },
        dependencies: {
          ...dependencies,
          '@platformatic/generators': `^${this.platformaticVersion}`,
          ...this.config.dependencies
        },
        engines: {
          node: '^18.8.0 || >=20.6.0'
        }
      }
    }

    return {
      main: 'index.js',
      scripts: {
        'build:config': 'node lib/schema.js | json2ts > config.d.ts',
        create: 'node cli/create.js --dir ./app',
        start: 'node cli/start.js -c ./app/platformatic.json'
      },
      devDependencies: {
        ...devDependencies,
        ...this.config.devDependencies
      },
      dependencies: {
        ...dependencies,
        ...this.config.dependencies
      },
      engines: {
        node: '^18.8.0 || >=20.6.0'
      }
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

  // implement in the subclass
  /* c8 ignore next 1 */
  async postInstallActions () {}
  async _beforePrepare () {}
  async _afterPrepare () {}
  async _getConfigFileContents () { return {} }
  async _generateEnv () {}
}

module.exports = StackableGenerator
module.exports.StackableGenerator = StackableGenerator
