'use strict'

const { loadConfig, tsCompiler } = require('@platformatic/service')
const { access } = require('fs/promises')
const { join } = require('path')
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
    const tsconfig = join(service.path, 'tsconfig.json')

    try {
      await access(tsconfig)
    } catch {
      logger.trace(`No tsconfig.json found in ${service.path}, skipping...`)
      continue
    }

    await tsCompiler.compile(service.path, {}, logger.child({ name: service.id }))
  }
}

module.exports.compile = compile
