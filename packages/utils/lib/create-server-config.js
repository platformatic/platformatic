'use strict'

function createServerConfig (config) {
  // convert the config file to a new structure
  // to make @fastify/restartable happy
  const serverConfig = Object.assign({ ...config.server }, config)
  delete serverConfig.server
  return serverConfig
}

module.exports = createServerConfig
