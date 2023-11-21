'use strict'

const { tsCompiler } = require('@platformatic/service')
const { loadConfig } = require('./load-config')
const { dirname } = require('node:path')

const pino = require('pino')
const pretty = require('pino-pretty')
const { isatty } = require('node:tty')

async function compile (argv, logger) {
  const { configManager, configType } = await loadConfig({}, argv, {
    watch: false
  }, false)
  /* c8 ignore next */
  if (!logger) {
    let stream

    if (isatty(process.stdout.fd)) {
      stream = pretty({
        translateTime: 'SYS:HH:MM:ss',
        ignore: 'hostname,pid'
      })
    }

    logger = pino(stream)
  }

  let compiled = false
  const compileOptions = {
    clean: argv.includes('--clean')
  }
  if (configType === 'runtime') {
    for (const service of configManager.current.services) {
      const childLogger = logger.child({ name: service.id })

      const serviceConfigPath = service.config
      const { configManager } = await loadConfig({}, ['-c', serviceConfigPath], {
        onMissingEnv (key) {
          return service.localServiceEnvVars.get(key)
        },
        watch: false
      }, false)

      const serviceWasCompiled = await tsCompiler.compile(service.path, configManager.current, childLogger, compileOptions)
      compiled ||= serviceWasCompiled
    }
  } else {
    compiled = await tsCompiler.compile(dirname(configManager.fullPath), configManager.current, logger, compileOptions)
  }

  return compiled
}

module.exports.compile = compile
