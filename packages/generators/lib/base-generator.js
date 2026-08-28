import { generateDashedName } from '@platformatic/foundation'
import {
  capabilityFactories,
  configurationFileNameFor,
  listDirectoryEntries,
  raw,
  selectConfigurationFileNames,
  selectLegacyConfigurationFileNames,
  serializeConfiguration,
  serializeString
} from '@platformatic/foundation/lib/v4/index.js'
import { generateCode, parseModule } from 'magicast'
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
        await this.#updatePackagesInPlace()
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
    const configFileName = this.configurationFileName()
    /*
      Read from the configuration the generator built rather than from the file it wrote: the file
      resolves each placeholder into an expression, so the text no longer carries the `{VAR}` this
      is looking for. What is being checked is whether the generator declared every variable it
      used, which is a question about the object.
    */
    const envVars = extractEnvVariablesFromText(JSON.stringify(this.generatedConfig ?? {}))
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
      if (!this.config.skipServer) {
        this.questions.push({
          type: 'input',
          name: 'port',
          message: 'What port do you want to use?'
        })
      }
    }
  }

  async generateConfigFile () {
    const configFileName = this.configurationFileName()
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

    /*
      Kept so that what reads this configuration back reads the object rather than re-parsing the
      file: the file is a module now, and its values are expressions rather than the literals the
      generator put in.
    */
    this.generatedConfig = contents

    this.addFile({
      path: '',
      file: configFileName,
      contents: this.serializeConfigFile(contents)
    })

    return contents
  }

  /*
    The v4 per-app form. A capability with a factory is spelled by calling it; one without keeps the
    stamped plain-object form, which is what the `$schema` marker exists for.

    The placeholders the generator writes are resolved here rather than left as text. v3 substituted
    `{PLT_API_PORT}` before anything read it, and v4 has no interpolation -- so the scaffolded value
    becomes the expression it stood for, with the default the generator was going to write into
    `.env` anyway.
  */
  /*
    An update touches one thing -- which packages the application loads -- and has to leave
    everything else exactly as the user left it.

    For a v4 configuration that means editing the module rather than rewriting it: its values are
    expressions, so reading it back and re-emitting would bake `Number(process.env.PORT || 3042)`
    into whatever the port happens to be on this machine, and would drop every comment with it.
  */
  async #updatePackagesInPlace () {
    const generated = this.generatedConfig ?? {}
    const packages = generated.plugins?.packages ?? []
    const existing = await this.#findExistingConfiguration()

    this.reset()

    if (!existing) {
      return
    }

    if (existing.file.endsWith('.json')) {
      // A v3 project being updated: it is data, and rewriting it loses nothing it carries.
      const current = JSON.parse(existing.contents)

      if (current.plugins) {
        current.plugins.packages = packages
      }

      this.addFile({ path: '', file: existing.file, contents: JSON.stringify(current, null, 2) })
      return
    }

    const module = parseModule(existing.contents)
    const target = module.exports.default
    // The factory form is a call whose first argument is the configuration; the plain object form
    // is the configuration itself.
    const configuration = target?.$type === 'function-call' ? target.$args[0] : target

    if (configuration) {
      configuration.plugins ??= {}
      configuration.plugins.packages = packages
    }

    this.addFile({ path: '', file: existing.file, contents: generateCode(module).code })
  }

  async #findExistingConfiguration () {
    const entries = await listDirectoryEntries(this.targetDirectory)
    const file = selectConfigurationFileNames(entries)[0] ?? selectLegacyConfigurationFileNames(entries)[0]

    if (!file) {
      return null
    }

    const loaded = await this.loadFile({ file, path: '' })

    return { contents: loaded.contents, file }
  }

  /*
    The suffix follows the rule the format sets: `.js` in a "type": "commonjs" package is CommonJS,
    where `export default` is a syntax error. The generator wrote that package.json a moment ago in
    this same pass, so it reads its own answer rather than the filesystem's.
  */
  configurationFileName () {
    let module = false

    try {
      module = JSON.parse(this.getFileObject('package.json', '')?.contents ?? '{}').type === 'module'
    } catch {
      // Not generated, or not JSON yet. The unambiguous suffix is the safe answer.
    }

    return configurationFileNameFor({ module, typescript: this.config.typescript })
  }

  serializeConfigFile (config) {
    const { $schema, module: declared, ...rest } = config
    const module = declared ?? this.module
    const factory = capabilityFactories[module]
    const resolved = this.#resolveScaffoldedPlaceholders(rest)

    if (!factory) {
      return `export default ${serializeConfiguration({ $schema, module, ...resolved })}\n`
    }

    return `import { ${factory} } from '${module}'\n\nexport default ${factory}(${serializeConfiguration(resolved)})\n`
  }

  #resolveScaffoldedPlaceholders (value) {
    if (typeof value === 'string') {
      const whole = value.match(/^\{([A-Za-z0-9_]+)\}$/)

      if (!whole) {
        return value
      }

      const name = whole[1]
      const fallback = this.config.env?.[name]

      if (fallback === undefined) {
        return raw(`process.env.${name}`)
      }

      /*
        `||` rather than `??`, and the difference is a real port: an env file carrying the ordinary
        empty assignment `PORT=` supplies `''`, which is present, so `??` would not fall back and
        `Number('')` is an ephemeral port where the reader of that line expects the default.
      */
      return /^[0-9]+$/.test(String(fallback))
        ? raw(`Number(process.env.${name} || ${fallback})`)
        : raw(`process.env.${name} || ${serializeString(String(fallback))}`)
    }

    if (value === null || typeof value !== 'object') {
      return value
    }

    if (Array.isArray(value)) {
      return value.map(entry => this.#resolveScaffoldedPlaceholders(entry))
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, this.#resolveScaffoldedPlaceholders(entry)])
    )
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
      version: '0.1.0',
      scripts: {
        dev: 'wattpm dev',
        start: 'wattpm start',
        build: 'wattpm build',
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
        node: '>=22.19.0'
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
