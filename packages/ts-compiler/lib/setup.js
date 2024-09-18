'use strict'

const { resolve } = require('node:path')
const pino = require('pino')
const pretty = require('pino-pretty')
const { isFileAccessible } = require('@platformatic/utils')
const { getTSCExecutablePath } = require('./tsc-executable')

async function setup (options) {
  if (!options.cwd) {
    throw new Error('The cwd option is required.')
  }

  let logger = options.logger
  if (!logger) {
    logger = pino(
      pretty({
        translateTime: 'SYS:HH:MM:ss.l',
        ignore: 'hostname,pid'
      })
    )
  }

  const { execa } = await import('execa')

  const tscExecutablePath = await getTSCExecutablePath(options.cwd)

  const tsConfigPath = options.tsConfig || resolve(options.cwd, 'tsconfig.json')
  const tsConfigExists = await isFileAccessible(tsConfigPath)

  return { execa, logger, tscExecutablePath, tsConfigPath, tsConfigExists }
}

module.exports = setup
