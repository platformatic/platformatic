'use strict'

const { isKeyEnabled } = require('@platformatic/utils')
const fp = require('fastify-plugin')

const compiler = require('../compile')

async function setupTsCompiler (app) {
  // TODO: move params to opts

  const configManager = app.platformatic.configManager
  const config = configManager.current

  const isRestartableApp = app.restarted !== undefined

  // to run the plugin without restartable
  /* c8 ignore next 1 */
  const persistentRef = isRestartableApp ? app.persistentRef : app

  const workingDir = configManager.dirname

  if (isKeyEnabled('watch', config)) {
    let tsCompilerWatcher = persistentRef.tsCompilerWatcher
    if (!tsCompilerWatcher) {
      /* c8 ignore next 5 */
      const { child } = await compiler.compileWatch(workingDir, config, app.log)
      app.log.debug('start watching typescript files')
      tsCompilerWatcher = child
    }
    app.decorate('tsCompilerWatcher', tsCompilerWatcher)
  } else {
    await compiler.compile(workingDir, config, app.log)
  }

  app.addHook('onClose', async () => {
    if (!isRestartableApp || app.closingRestartable) {
      /* c8 ignore next 4 */
      if (app.tsCompilerWatcher) {
        app.tsCompilerWatcher.kill('SIGTERM')
        app.log.debug('stop watching typescript files')
      }
    }
  })
}

module.exports = fp(setupTsCompiler)
