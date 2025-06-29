'use strict'

const fp = require('fastify-plugin')
const compiler = require('@platformatic/ts-compiler')

async function setupTsCompiler (app, opts) {
  const configManager = app.platformatic.configManager
  const config = configManager.current
  const workingDir = opts?.context?.directory ?? configManager.dirname

  await compiler.compile({
    tsConfig: config.plugins?.typescript?.tsConfig,
    flags: config.plugins?.typescript?.flags,
    cwd: workingDir,
    clean: false,
    logger: app.log,
  })
}

module.exports = fp(setupTsCompiler)
