'use strict'

const diagnosticsChannel = require('node:diagnostics_channel')

const CHANNEL_NAME_START_REQUEST_START = 'http.server.request.start'
const CHANNEL_NAME_START_REQUEST_FINISH = 'http.server.response.finish'
const channelStart = diagnosticsChannel.channel(CHANNEL_NAME_START_REQUEST_START)
const channelFinish = diagnosticsChannel.channel(CHANNEL_NAME_START_REQUEST_FINISH)

const createMetricsThreadInterceptorHooks = () => {
  const onServerRequest = (request, cb) => {
    const server = request.server
    channelStart.publish({
      request,
      server
    })
    cb()
  }

  const onServerResponse = (request, response) => {
    channelFinish.publish({
      request,
      response
    })
  }

  const onServerError = (request, response, _error) => {
    const server = request.server
    channelFinish.publish({
      request,
      response,
      server
    })
  }

  return {
    onServerRequest,
    onServerResponse,
    onServerError,
  }
}

module.exports = {
  createMetricsThreadInterceptorHooks
}
