'use strict'

const { BaseGenerator } = require('@platformatic/generators')
const { NoEntryPointError, NoServiceNamedError } = require('./errors')
const generateName = require('boring-name-generator')
const { join } = require('node:path')
const { envObjectToString } = require('@platformatic/generators/lib/utils')
const { readFile, readdir, stat, rm } = require('node:fs/promises')
const { ConfigManager } = require('@platformatic/config')
const { platformaticRuntime } = require('../config')
const { getServiceTemplateFromSchemaUrl } = require('@platformatic/generators/lib/utils')
const { DotEnvTool } = require('dotenv-tool')
const { getArrayDifference } = require('../utils')
const { createRequire } = require('node:module')
const { pathToFileURL } = require('node:url')

class RuntimeGenerator extends BaseGenerator {
  constructor (opts) {
    super({
      ...opts,
      module: '@platformatic/runtime',
    })
    this.runtimeName = opts.name
    this.services = []
    this.entryPoint = null
  }

  async addService (service, name) {
    // ensure service config is correct
    const originalConfig = service.config
    const serviceName = name || generateName().dashed
    const newConfig = {
      ...originalConfig,
      isRuntimeContext: true,
      serviceName,
    }
    // reset all files previously generated by the service
    service.reset()
    service.setConfig(newConfig)
    this.services.push({
      name: serviceName,
      service,
    })

    if (typeof service.setRuntime === 'function') {
      service.setRuntime(this)
    }
  }

  setEntryPoint (entryPoint) {
    const service = this.services.find((svc) => svc.name === entryPoint)
    if (!service) {
      throw new NoServiceNamedError(entryPoint)
    }
    this.entryPoint = service
  }

  async generatePackageJson () {
    const template = {
      name: `${this.runtimeName}`,
      workspaces: ['services/*'],
      scripts: {
        start: 'platformatic start',
      },
      devDependencies: {
        fastify: `^${this.fastifyVersion}`,
        borp: `${this.pkgData.devDependencies.borp}`,
      },
      dependencies: {
        '@platformatic/runtime': `^${this.platformaticVersion}`,
        platformatic: `^${this.platformaticVersion}`,
        ...this.config.dependencies,
      },
      engines: {
        node: '^18.8.0 || >=20.6.0',
      },
    }
    if (this.config.typescript) {
      const typescriptVersion = JSON.parse(await readFile(join(__dirname, '..', '..', 'package.json'), 'utf-8')).devDependencies.typescript
      template.scripts.clean = 'rm -fr ./dist'
      template.scripts.build = 'platformatic compile'
      template.devDependencies.typescript = typescriptVersion
    }
    return template
  }

  async _beforePrepare () {
    this.setServicesDirectory()
    this.setServicesConfigValues()
    this.addServicesDependencies()

    this.addEnvVars({
      PLT_SERVER_HOSTNAME: '127.0.0.1',
      PORT: this.config.port || 3042,
      PLT_SERVER_LOGGER_LEVEL: this.config.logLevel || 'info',
      PLT_MANAGEMENT_API: true,
    }, { overwrite: false, default: true })
  }

  addServicesDependencies () {
    this.services.forEach(({ service }) => {
      if (service.config.dependencies) {
        Object.entries(service.config.dependencies).forEach((kv) => {
          this.config.dependencies[kv[0]] = kv[1]
        })
      }
    })
  }

  async populateFromExistingConfig () {
    if (this._hasCheckedForExistingConfig) {
      return
    }
    this._hasCheckedForExistingConfig = true
    const existingConfigFile = await ConfigManager.findConfigFile(this.targetDirectory, 'runtime')
    if (existingConfigFile) {
      const configManager = new ConfigManager({
        ...platformaticRuntime.configManagerConfig,
        source: join(this.targetDirectory, existingConfigFile),
      })
      await configManager.parse()
      this.existingConfig = configManager.current
      this.config.env = configManager.env
      this.config.port = configManager.env.PORT
      this.entryPoint = configManager.current.services.find((svc) => svc.entrypoint)
    }
  }

  async prepare () {
    await this.populateFromExistingConfig()
    if (this.existingConfig) {
      this.setServicesDirectory()
      this.setServicesConfigValues()
      await this._afterPrepare()
      return {
        env: this.config.env,
        targetDirectory: this.targetDirectory,
      }
    } else {
      return await super.prepare()
    }
  }

  setServicesConfigValues () {
    this.services.forEach(({ service }) => {
      if (!service.config) {
        // set default config
        service.setConfig()
      }
      service.config.typescript = this.config.typescript
    })
  }

  async _getConfigFileContents () {
    const config = {
      $schema: `https://schemas.platformatic.dev/@platformatic/runtime/${this.platformaticVersion}.json`,
      entrypoint: this.entryPoint.name,
      hotReload: true,
      autoload: {
        path: 'services',
        exclude: ['docs'],
      },
      server: {
        hostname: '{PLT_SERVER_HOSTNAME}',
        port: '{PORT}',
        logger: {
          level: '{PLT_SERVER_LOGGER_LEVEL}',
        },
      },
      managementApi: '{PLT_MANAGEMENT_API}',
    }

    return config
  }

  async _afterPrepare () {
    if (!this.entryPoint) {
      throw new NoEntryPointError()
    }
    const servicesEnv = await this.prepareServiceFiles()
    this.addEnvVars({
      ...this.config.env,
      ...this.getRuntimeEnv(),
      ...servicesEnv,
    })

    this.addFile({
      path: '',
      file: '.env',
      contents: envObjectToString(this.config.env),
    })

    this.addFile({
      path: '',
      file: '.env.sample',
      contents: envObjectToString(this.config.env),
    })

    if (!this.existingConfig) {
      this.addFile({ path: '', file: 'README.md', contents: await readFile(join(__dirname, 'README.md')) })
    }

    return {
      targetDirectory: this.targetDirectory,
      env: servicesEnv,
    }
  }

  async writeFiles () {
    await super.writeFiles()
    if (!this.config.isUpdating) {
      for (const { service } of this.services) {
        await service.writeFiles()
      }
    }
  }

  async prepareQuestions () {
    await this.populateFromExistingConfig()

    // typescript
    this.questions.push({
      type: 'list',
      name: 'typescript',
      message: 'Do you want to use TypeScript?',
      default: false,
      choices: [{ name: 'yes', value: true }, { name: 'no', value: false }],
    })

    if (this.existingConfig) {
      return
    }

    // port
    this.questions.push({
      type: 'input',
      name: 'port',
      default: 3042,
      message: 'What port do you want to use?',
    })
  }

  setServicesDirectory () {
    this.services.forEach(({ service }) => {
      if (!service.config) {
        // set default config
        service.setConfig()
      }
      service.setTargetDirectory(join(this.targetDirectory, 'services', service.config.serviceName))
    })
  }

  setServicesConfig (configToOverride) {
    this.services.forEach((service) => {
      const originalConfig = service.config
      service.setConfig({
        ...originalConfig,
        ...configToOverride,
      })
    })
  }

  async prepareServiceFiles () {
    let servicesEnv = {}
    for (const svc of this.services) {
      // Propagate TypeScript
      svc.service.setConfig({
        ...svc.service.config,
        typescript: this.config.typescript,
      })
      const svcEnv = await svc.service.prepare()
      servicesEnv = {
        ...servicesEnv,
        ...svcEnv.env,
      }
    }
    return servicesEnv
  }

  getConfigFieldsDefinitions () {
    return []
  }

  setConfigFields () {
    // do nothing, makes no sense
  }

  getRuntimeEnv () {
    return {
      PORT: this.config.port,
    }
  }

  async postInstallActions () {
    for (const { service } of this.services) {
      await service.postInstallActions()
    }
  }

  async _getGeneratorForTemplate (dir, pkg) {
    const _require = createRequire(dir)
    const fileToImport = _require.resolve(pkg)
    return (await import(pathToFileURL(fileToImport))).Generator
  }

  async loadFromDir () {
    const output = {
      services: [],
    }
    const runtimePkgConfigFileData = JSON.parse(await readFile(join(this.targetDirectory, 'platformatic.json'), 'utf-8'))
    const servicesPath = join(this.targetDirectory, runtimePkgConfigFileData.autoload.path)

    // load all services
    const allServices = await readdir(servicesPath)
    for (const s of allServices) {
      // check is a directory
      const currentServicePath = join(servicesPath, s)
      const dirStat = await stat(currentServicePath)
      if (dirStat.isDirectory()) {
        // load the package json file
        const servicePltJson = JSON.parse(await readFile(join(currentServicePath, 'platformatic.json'), 'utf-8'))
        // get module to load
        const template = servicePltJson.module || getServiceTemplateFromSchemaUrl(servicePltJson.$schema)
        const Generator = await this._getGeneratorForTemplate(currentServicePath, template)
        const instance = new Generator({
          logger: this.logger,
        })
        this.addService(instance, s)
        output.services.push(await instance.loadFromDir(s, this.targetDirectory))
      }
    }
    return output
  }

  async update (newConfig) {
    let allServicesDependencies = {}
    const runtimeAddedEnvKeys = []

    this.config.isUpdating = true
    const currrentPackageJson = JSON.parse(await readFile(join(this.targetDirectory, 'package.json'), 'utf-8'))
    const currentRuntimeDependencies = currrentPackageJson.dependencies
    // check all services are present with the same template
    const allCurrentServicesNames = this.services.map((s) => s.name)
    const allNewServicesNames = newConfig.services.map((s) => s.name)
    // load dotenv tool
    const envTool = new DotEnvTool({
      path: join(this.targetDirectory, '.env'),
    })

    await envTool.load()

    const removedServices = getArrayDifference(allCurrentServicesNames, allNewServicesNames)
    if (removedServices.length > 0) {
      for (const removedService of removedServices) {
        // handle service delete

        // delete env variables
        const s = this.services.find((f) => f.name === removedService)
        const allKeys = envTool.getKeys()
        allKeys.forEach((k) => {
          if (k.startsWith(`PLT_${s.service.config.envPrefix}`)) {
            envTool.deleteKey(k)
          }
        })

        // delete dependencies
        const servicePackageJson = JSON.parse(await readFile(join(this.targetDirectory, 'services', s.name, 'platformatic.json')))
        if (servicePackageJson.plugins && servicePackageJson.plugins.packages) {
          servicePackageJson.plugins.packages
            .forEach((p) => {
              delete (currrentPackageJson.dependencies[p.name])
            })
        }
        // delete directory
        await rm(join(this.targetDirectory, 'services', s.name), { recursive: true })
      }
      // throw new CannotRemoveServiceOnUpdateError(removedServices.join(', '))
    }

    // handle new services
    for (const newService of newConfig.services) {
      // create generator for the service
      const ServiceGenerator = await this._getGeneratorForTemplate(join(this.targetDirectory, 'package.json'), newService.template)
      const serviceInstance = new ServiceGenerator({
        logger: this.logger,
      })
      const baseConfig = {
        isRuntimeContext: true,
        targetDirectory: join(this.targetDirectory, 'services', newService.name),
        serviceName: newService.name,
        plugin: true,
      }
      if (allCurrentServicesNames.includes(newService.name)) {
        // update existing services env values
        // otherwise, is a new service
        baseConfig.isUpdating = true

        // handle service's plugin differences
        const oldServiceMetadata = await serviceInstance.loadFromDir(newService.name, this.targetDirectory)
        const oldServicePackages = oldServiceMetadata.plugins.map((meta) => meta.name)
        const newServicePackages = newService.plugins.map((meta) => meta.name)
        const pluginsToRemove = getArrayDifference(oldServicePackages, newServicePackages)
        pluginsToRemove.forEach((p) => delete currentRuntimeDependencies[p])
      } else {
        // add service to the generator
        this.services.push({
          name: newService.name,
          service: serviceInstance,
        })
      }
      serviceInstance.setConfig(baseConfig)
      serviceInstance.setConfigFields(newService.fields)

      const serviceEnvPrefix = `PLT_${serviceInstance.config.envPrefix}`
      for (const plug of newService.plugins) {
        await serviceInstance.addPackage(plug)
        for (const opt of plug.options) {
          const key = `${serviceEnvPrefix}_${opt.name}`
          runtimeAddedEnvKeys.push(key)
          const value = opt.value
          if (envTool.hasKey(key)) {
            envTool.updateKey(key, value)
          } else {
            envTool.addKey(key, value)
          }
        }
      }
      allServicesDependencies = { ...allServicesDependencies, ...serviceInstance.config.dependencies }
      const afterPrepareMetadata = await serviceInstance.prepare()
      await serviceInstance.writeFiles()
      // cleanup runtime env removing keys not present anymore in service plugins
      const allKeys = envTool.getKeys()
      allKeys.forEach((k) => {
        if (k.startsWith(`${serviceEnvPrefix}_FST_PLUGIN`) && !runtimeAddedEnvKeys.includes(k)) {
          envTool.deleteKey(k)
        }
      })

      // add service env variables to runtime env
      Object.entries(afterPrepareMetadata.env).forEach(([key, value]) => {
        envTool.addKey(key, value)
      })
    }
    // update runtime package.json dependencies
    currrentPackageJson.dependencies = {
      ...currrentPackageJson.dependencies,
      ...allServicesDependencies,
    }
    this.addFile({
      path: '',
      file: 'package.json',
      contents: JSON.stringify(currrentPackageJson, null, 2),
    })

    // set new entrypoint if specified
    const newEntrypoint = newConfig.entrypoint
    if (newEntrypoint) {
      // load platformatic.json runtime config
      const runtimePkgConfigFileData = JSON.parse(await readFile(join(this.targetDirectory, 'platformatic.json'), 'utf-8'))

      this.setEntryPoint(newEntrypoint)
      runtimePkgConfigFileData.entrypoint = newEntrypoint
      this.addFile({
        path: '',
        file: 'platformatic.json',
        contents: JSON.stringify(runtimePkgConfigFileData, null, 2),
      })
    }
    await this.writeFiles()
    // save new env
    await envTool.save()
  }
}

module.exports = RuntimeGenerator
module.exports.RuntimeGenerator = RuntimeGenerator
