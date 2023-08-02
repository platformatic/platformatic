'use strict'

const { tsCompiler } = require('@platformatic/service')
const { loadConfig } = require('./unified-api')
const { dirname } = require('node:path')

const pino = require('pino')
const pretty = require('pino-pretty')
const { isatty } = require('node:tty')

async function compile (argv, logger) {
  const { configManager, configType } = await loadConfig({}, argv, undefined, {
    watch: false
  })

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

  if (configType === 'runtime') {
    for (const service of configManager.current.services) {
      const childLogger = logger.child({ name: service.id })

      const serviceConfig = await loadConfig({}, argv, undefined, {
        watch: false
      })

      const serviceWasCompiled = await tsCompiler.compile(service.path, serviceConfig.config, childLogger)
      compiled ||= serviceWasCompiled
    }
  } else {
    compiled = await tsCompiler.compile(dirname(configManager.fullPath), configManager.current, logger)
  }

  return compiled
}

module.exports.compile = compile
