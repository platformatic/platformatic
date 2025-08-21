'use strict'

module.exports = {
  version: '2.99.0',
  up (config) {
    if (typeof config.gracefulShutdown?.service === 'number') {
      config.gracefulShutdown.application = config.gracefulShutdown.service
      delete config.gracefulShutdown.service
    }

    if (typeof config.serviceTimeout === 'number') {
      config.applicationTimeout = config.serviceTimeout
      delete config.serviceTimeout
    }

    return config
  }
}
