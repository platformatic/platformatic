'use strict'

const TelemetrySchema = {
  $id: '/OpenTelemetry',
  type: 'object',
  properties: {
    serviceName: {
      type: 'string',
      description: 'The name of the service. Defaults to the folder name if not specified.'
    },
    version: {
      type: 'string',
      description: 'The version of the service (optional)'
    },
    skip: {
      type: 'array',
      description: 'An array of paths to skip when creating spans. Useful for health checks and other endpoints that do not need to be traced.',
      items: {
        type: 'string'
      }
    },
    exporter: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['console', 'otlp', 'zipkin', 'memory'],
          default: 'console'
        },
        options: {
          type: 'object',
          description: 'Options for the exporter. These are passed directly to the exporter.',
          properties: {
            url: {
              type: 'string',
              description: 'The URL to send the traces to. Not used for console or memory exporters.'
            },
            headers: {
              type: 'object',
              description: 'Headers to send to the exporter. Not used for console or memory exporters.'
            }
          }
        },
        additionalProperties: false
      }
    }
  },
  required: ['serviceName'],
  additionalProperties: false
}

module.exports = TelemetrySchema
