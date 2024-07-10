'use strict'

const fp = require('fastify-plugin')
const compiler = require('@platformatic/ts-compiler')

async function setupTsCompiler (app) {
  const configManager = app.platformatic.configManager
  const config = configManager.current
  const workingDir = configManager.dirname

  await compiler.compile({
    cwd: workingDir,
    clean: false,
    logger: app.log,
    tsConfig: config.plugins?.typescript?.tsConfig,
    flags: config.plugins?.typescript?.flags
  })
}

module.exports = fp(setupTsCompiler)
