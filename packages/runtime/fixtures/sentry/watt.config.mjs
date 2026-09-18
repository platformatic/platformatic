// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  logger: {
    level: 'trace',
    transport: {
      targets: [
        {
          target: 'pino/file'
        },
        {
          target: 'pino-sentry-transport',
          options: {
            sentry: {
              dsn: process.env.PLT_SENTRY_DSN,
              tunnel: process.env.PLT_SENTRY_TUNNEL,
              enableLogs: true
            },
            withLogRecord: true,
            tags: [
              'level',
              'name',
              'worker',
              'application',
              'applicationId',
              'operation'
            ],
            context: [
              'level',
              'name',
              'err',
              'error',
              'req',
              'url',
              'path',
              'method',
              'headers',
              'application',
              'applicationId',
              'worker',
              'event',
              'payload',
              'operation',
              'topic',
              'entity',
              'key'
            ]
          }
        }
      ]
    }
  },
  applications: [
    {
      id: 'node',
      path: './node'
    }
  ]
}
