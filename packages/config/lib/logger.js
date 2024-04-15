'use strict'

const abstractlogger = require('abstract-logging')

const logger = Object.create(abstractlogger)
logger.child = function () {
  return logger
}

module.exports = logger
