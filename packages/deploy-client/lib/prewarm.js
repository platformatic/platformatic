'use strict'

const { request } = require('undici')
const errors = require('./errors')

const PREWARM_REQUEST_TIMEOUT = 2 * 60 * 1000
const PREWARM_REQUEST_ATTEMPTS = 5

const defaultLogger = {
  warn: console.warn
}

async function makePrewarmRequest (appUrl, logger = defaultLogger, attempt = 1) {
  try {
    const { statusCode, body } = await request(appUrl, {
      method: 'GET',
      headersTimeout: PREWARM_REQUEST_TIMEOUT
    })

    if (statusCode >= 500) {
      const error = await body.text()
      throw new errors.RequestFailedError(statusCode, error)
    }
  } catch (error) {
    if (attempt < PREWARM_REQUEST_ATTEMPTS) {
      logger.warn(`Could not make a prewarm call: ${error.message}, retrying...`)
      return makePrewarmRequest(appUrl, logger, attempt + 1)
    }
    throw new errors.CouldNotMakePrewarmCallError(error.message)
  }
}

module.exports = makePrewarmRequest
