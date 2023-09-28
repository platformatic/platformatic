'use strict'

const { resolve, join, dirname } = require('path')
const pino = require('pino')
const pretty = require('pino-pretty')
const { loadConfig } = require('@platformatic/config')
const { isFileAccessible } = require('./utils.js')

async function getTSCExecutablePath (cwd) {
  const typescriptPath = require.resolve('typescript')
  const typescriptPathCWD = require.resolve('typescript', { paths: [process.cwd()] })

  const tscLocalPath = join(typescriptPath, '..', '..', 'bin', 'tsc')
  const tscGlobalPath = join(typescriptPathCWD, '..', '..', 'bin', 'tsc')

  const [tscLocalExists, tscGlobalExists] = await Promise.all([
    isFileAccessible(tscLocalPath),
    isFileAccessible(tscGlobalPath)
  ])

  /* c8 ignore next 7 */
  if (tscLocalExists) {
    return tscLocalPath
  }

  if (tscGlobalExists) {
    return tscGlobalPath
  }
}

async function setup (cwd, config, logger) {
  if (!logger) {
    logger = pino(
      pretty({
        translateTime: 'SYS:HH:MM:ss',
        ignore: 'hostname,pid'
      })
    )

    if (config?.server.logger) {
      logger.level = config.server.logger.level
    }
  }

  const { execa } = await import('execa')

  const tscExecutablePath = await getTSCExecutablePath(cwd)
  /* c8 ignore next 4 */
  if (tscExecutablePath === undefined) {
    const msg = 'The tsc executable was not found.'
    logger.warn(msg)
  }

  const tsConfigPath = config?.plugins?.typescript?.tsConfig || resolve(cwd, 'tsconfig.json')
  const tsConfigExists = await isFileAccessible(tsConfigPath)

  if (!tsConfigExists) {
    const msg = 'No typescript configuration file was found, skipping compilation.'
    logger.info(msg)
  }

  return { execa, logger, tscExecutablePath, tsConfigPath, tsConfigExists }
}

async function compile (cwd, config, originalLogger) {
  const { execa, logger, tscExecutablePath, tsConfigPath, tsConfigExists } = await setup(cwd, config, originalLogger)
  /* c8 ignore next 3 */
  if (!tscExecutablePath || !tsConfigExists) {
    return false
  }

  try {
    const tsFlags = config?.plugins?.typescript?.flags || ['--project', tsConfigPath, '--rootDir', '.']
    console.log('ts flags', tsFlags)

    const child = execa(tscExecutablePath, [], {
      cwd,
      killSignal: 'SIGKILL'
    })

    console.log('ts process pid', child.pid)

    child.stdout.pipe(process.stdout)
    child.stderr.pipe(process.stderr)

    await child

    logger.info('Typescript compilation completed successfully.')
    return true
  } catch (error) {
    logger.error(error.message)
    return false
  }
}

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

    if (!await compile(fullPath, config)) {
      process.exit(1)
    }
  }
}

module.exports.compile = compile
module.exports.buildCompileCmd = buildCompileCmd
