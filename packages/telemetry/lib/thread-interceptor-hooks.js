'use strict'

const { setupTelemetry } = require('./telemetry-config')

const createTelemetryThreadInterceptorHooks = (telemetry, logger) => {
  const {
    startHTTPSpan,
    endHTTPSpan,
    setErrorInSpan,
    startHTTPSpanClient,
    endHTTPSpanClient,
    setErrorInSpanClient,
  } = setupTelemetry(telemetry, logger)

  const onServerRequest = (req) => {
    startHTTPSpan(req)
  }

  const onServerResponse = (res, reply) => {
    endHTTPSpan(res, reply)
  }

  const onServerError = (err) => {
    setErrorInSpan(err)
  }

  const onClientRequest = (req, ctx) => {
    const { origin, method, path } = req
    const targetUrl = `${origin}${path}`
    const { span } = startHTTPSpanClient(targetUrl, method)
    ctx.span = span
  }

  const onClientResponse = (_req, res, ctx) => {
    const span = ctx.span ?? null
    endHTTPSpanClient(span, res)
  }

  const onClientError = (_req, _res, ctx, error) => {
    const span = ctx.span ?? null
    setErrorInSpanClient(span, error)
  }

  return {
    onServerRequest,
    onServerResponse,
    onServerError,
    onClientRequest,
    onClientResponse,
    onClientError
  }
}

module.exports = {
  createTelemetryThreadInterceptorHooks
}
