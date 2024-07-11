'use strict'

const fp = require('fastify-plugin')
const compiler = require('@platformatic/ts-compiler')
const { extractTypeScriptCompileOptionsFromConfig } = require('../compile')

async function setupTsCompiler (app) {
  const configManager = app.platformatic.configManager
  const config = configManager.current
  const workingDir = configManager.dirname

  await compiler.compile({
    ...extractTypeScriptCompileOptionsFromConfig(config),
    cwd: workingDir,
    clean: false,
    logger: app.log
  })
}

module.exports = fp(setupTsCompiler)
