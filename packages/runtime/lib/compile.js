'use strict'

const { loadConfig, tsCompiler } = require('@platformatic/service')
const pino = require('pino')
const pretty = require('pino-pretty')
const { isatty } = require('node:tty')

const { platformaticRuntime } = require('./config')

async function compile (argv) {
  const { configManager } = await loadConfig({}, argv, platformaticRuntime, {
    watch: false
  })

  let stream

  /* c8 ignore next 6 */
  if (isatty(process.stdout.fd)) {
    stream = pretty({
      translateTime: 'SYS:HH:MM:ss',
      ignore: 'hostname,pid'
    })
  }

  const logger = pino(stream)

  for (const service of configManager.current.services) {
    const childLogger = logger.child({ name: service.id })

    const serviceConfig = await loadConfig({}, argv, platformaticRuntime, {
      watch: false
    })

    const compiled = await tsCompiler.compile(service.path, serviceConfig.config, childLogger)
    if (!compiled) {
      logger.trace('No typescript found, skipping compilation')
    }
  }
}

module.exports.compile = compile
