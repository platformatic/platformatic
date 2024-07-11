'use strict'

const { compile } = require('@platformatic/ts-compiler')
const { loadConfig } = require('@platformatic/config')
const pino = require('pino')
const pretty = require('pino-pretty')
const { dirname } = require('path')

function buildCompileCmd (app) {
  return async function compileCmd (_args) {
    let fullPath = null
    let config = null

    try {
      const { configManager } = await loadConfig({}, _args, app, {
        watch: false
      })
      await configManager.parseAndValidate()
      config = configManager.current
      fullPath = dirname(configManager.fullPath)
      /* c8 ignore next 4 */
    } catch (err) {
      console.error(err)
      process.exit(1)
    }

    const logger = pino(
      pretty({
        translateTime: 'SYS:HH:MM:ss',
        ignore: 'hostname,pid'
      })
    )

    const compileOptions = {
      ...extractTypeScriptCompileOptionsFromConfig(config),
      cwd: fullPath,
      logger,
      clean: _args.includes('--clean')
    }

    if (!await compile(compileOptions)) {
      process.exit(1)
    }
  }
}

module.exports.buildCompileCmd = buildCompileCmd

function extractTypeScriptCompileOptionsFromConfig (config) {
  return {
    tsConfig: config.plugins?.typescript?.tsConfig,
    flags: config.plugins?.typescript?.flags
  }
}

module.exports.extractTypeScriptCompileOptionsFromConfig = extractTypeScriptCompileOptionsFromConfig
