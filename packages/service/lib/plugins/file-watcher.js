'use strict'

const { FileWatcher } = require('@platformatic/utils')
const fp = require('fastify-plugin')

async function setupFileWatcher (app, opts) {
  // TODO: move params to opts

  const configManager = app.platformatic.configManager
  const config = configManager.current

  const isRestartableApp = app.restarted !== undefined

  // to run the plugin without restartable
  /* c8 ignore next 1 */
  const persistentRef = isRestartableApp ? app.persistentRef : app

  let fileWatcher = persistentRef.fileWatcher
  if (!fileWatcher) {
    fileWatcher = new FileWatcher({
      path: configManager.dirname,
      allowToWatch: config.watch?.allow,
      watchIgnore: config.watch?.ignore
    })

    /* c8 ignore next 3 */
    fileWatcher.on('update', () => {
      opts.onFilesUpdated(persistentRef)
    })

    app.log.debug('start watching files')
    fileWatcher.startWatching()
  }

  app.decorate('fileWatcher', fileWatcher)

  app.addHook('onClose', async () => {
    if (!isRestartableApp || app.closingRestartable) {
      app.fileWatcher.stopWatching()
      app.log.debug('stop watching files')
    }
  })
}

module.exports = fp(setupFileWatcher)
