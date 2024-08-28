'use strict'

const fp = require('fastify-plugin')
const compiler = require('@platformatic/ts-compiler')
const { extractTypeScriptCompileOptionsFromConfig } = require('../compile')

async function setupTsCompiler (app, opts) {
  const configManager = app.platformatic.configManager
  const config = configManager.current
  const workingDir = opts?.context?.directory ?? configManager.dirname

  await compiler.compile({
    ...extractTypeScriptCompileOptionsFromConfig(config),
    cwd: workingDir,
    clean: false,
    logger: app.log,
  })
}

module.exports = fp(setupTsCompiler)
