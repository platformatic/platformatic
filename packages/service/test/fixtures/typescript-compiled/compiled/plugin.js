'use strict'

async function plugin (app) {
  app.log.info('Typescript plugin loaded')
}
module.exports = plugin
