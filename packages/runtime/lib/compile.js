'use strict'

const { dirname } = require('node:path')
const { isatty } = require('node:tty')

const tsCompiler = require('@platformatic/ts-compiler')
const pino = require('pino')
const pretty = require('pino-pretty')

const { loadConfig } = require('./utils')

async function compile (argv, logger) {
  const { configManager, configType, app } = await loadConfig(
    {},
    argv,
    {
      watch: false
    },
    false
  )
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
      const { configManager, app } = await loadConfig(
        {},
        ['-c', serviceConfigPath],
        {
          onMissingEnv (key) {
            return service.localServiceEnvVars.get(key)
          },
          watch: false
        },
        false
      )

      const tsOptions = await extract(configManager, app)

      if (tsOptions) {
        const serviceWasCompiled = await tsCompiler.compile({
          ...compileOptions,
          ...tsOptions,
          cwd: service.path,
          logger: childLogger
        })
        compiled ||= serviceWasCompiled
      }
    }
  } else {
    const tsOptions = await extract(configManager, app)
    if (tsOptions) {
      compiled = await tsCompiler.compile({
        ...compileOptions,
        ...tsOptions,
        cwd: dirname(configManager.fullPath),
        logger
      })
    }
  }

  return compiled
}

async function extract (configManager, app) {
  return app.getTypescriptCompilationOptions?.(configManager.current)
}

module.exports.compile = compile
