// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  logger: {
    level: 'error'
  },
  messagingTimeout: 200,
  telemetry: {
    applicationName: 'test-telemetry-messaging-runtime',
    version: '1.0.0',
    exporter: {
      type: 'file',
      options: {
        path: process.env.PLT_TELEMETRY_SPANS_PATH
      }
    }
  },
  applications: [
    {
      id: 'entrypoint',
      path: './entrypoint'
    },
    {
      id: 'ipc',
      path: './ipc'
    }
  ]
}
