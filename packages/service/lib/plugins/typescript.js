'use strict'

const fp = require('fastify-plugin')
const compiler = require('../compile')

async function setupTsCompiler (app) {
  // TODO: move params to opts

  const configManager = app.platformatic.configManager
  const config = configManager.current
  const workingDir = configManager.dirname

  await compiler.compile(workingDir, config, app.log, { clean: false })
}

module.exports = fp(setupTsCompiler)
