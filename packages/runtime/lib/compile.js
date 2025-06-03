'use strict'

const { createRequire } = require('node:module')
const { dirname, join } = require('node:path')
const { isatty } = require('node:tty')
const { pathToFileURL } = require('node:url')

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
  let extractTypeScriptCompileOptionsFromConfig = app.extractTypeScriptCompileOptionsFromConfig

  if (!extractTypeScriptCompileOptionsFromConfig) {
    // This is a bit of a hack, but it is needed to avoid a circular dependency
    // it also allow for customizations if needed
    const _require = createRequire(join(configManager.dirname, 'package.json'))
    const toLoad = _require.resolve('@platformatic/service')
    try {
      extractTypeScriptCompileOptionsFromConfig = (await import(pathToFileURL(toLoad)))
        .extractTypeScriptCompileOptionsFromConfig
    } catch {}
    // If we can't load `@platformatic/service` we just return null
    // and we won't be compiling typescript
  }

  if (!extractTypeScriptCompileOptionsFromConfig) {
    return null
  }

  return extractTypeScriptCompileOptionsFromConfig(configManager.current)
}

module.exports.compile = compile
