'use strict'

const { resolve, join, dirname } = require('path')
const pino = require('pino')
const pretty = require('pino-pretty')
const { loadConfig } = require('./load-config.js')
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

async function setup (cwd, config) {
  const logger = pino(
    pretty({
      translateTime: 'SYS:HH:MM:ss',
      ignore: 'hostname,pid'
    })
  )

  if (config?.server.logger) {
    logger.level = config.server.logger.level
  }

  const { execa } = await import('execa')

  const tscExecutablePath = await getTSCExecutablePath(cwd)
  /* c8 ignore next 4 */
  if (tscExecutablePath === undefined) {
    const msg = 'The tsc executable was not found.'
    logger.error(msg)
  }

  const tsconfigPath = resolve(cwd, 'tsconfig.json')
  const tsconfigExists = await isFileAccessible(tsconfigPath)

  if (!tsconfigExists) {
    const msg = 'The tsconfig.json file was not found.'
    logger.error(msg)
  }

  return { execa, logger, tscExecutablePath }
}

async function compile (cwd, config) {
  const { execa, logger, tscExecutablePath } = await setup(cwd, config)
  /* c8 ignore next 3 */
  if (!tscExecutablePath) {
    return false
  }

  try {
    await execa(tscExecutablePath, ['--project', 'tsconfig.json', '--rootDir', '.'], { cwd })
    logger.info('Typescript compilation completed successfully.')
    return true
  } catch (error) {
    logger.error(error.message)
    return false
  }
}

// This path is tested but C8 does not see it that way given it needs to work
// through execa.
/* c8 ignore next 20 */
async function compileWatch (cwd, config) {
  const { execa, logger, tscExecutablePath } = await setup(cwd, config)
  if (!tscExecutablePath) {
    return false
  }

  try {
    await execa(tscExecutablePath, ['--project', 'tsconfig.json', '--incremental', '--rootDir', '.'], { cwd })
    logger.info('Typescript compilation completed successfully. Starting watch mode.')
  } catch (error) {
    throw new Error('Failed to compile typescript files: ' + error)
  }

  const child = execa(tscExecutablePath, ['--project', 'tsconfig.json', '--watch', '--incremental'], { cwd })
  child.stdout.resume()
  child.stderr.on('data', (data) => {
    logger.error(data.toString())
  })

  return { child }
}

function buildCompileCmd (_loadConfig) {
  return async function compileCmd (_args) {
    let fullPath = null
    try {
      const { configManager } = await _loadConfig({}, _args)
      await configManager.parseAndValidate()
      fullPath = dirname(configManager.fullPath)
      /* c8 ignore next 4 */
    } catch (err) {
      console.error(err)
      process.exit(1)
    }

    if (!await compile(fullPath)) {
      process.exit(1)
    }
  }
}

const compileCmd = buildCompileCmd(loadConfig)

module.exports.compile = compile
module.exports.compileWatch = compileWatch
module.exports.buildCompileCmd = buildCompileCmd
module.exports.compileCmd = compileCmd
