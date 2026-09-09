// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  managementApi: false,
  metrics: false,
  logger: {
    level: 'warn'
  },
  applications: [
    {
      id: 'privileged',
      path: 'privileged',
      management: true
    },
    {
      id: 'restricted',
      path: 'restricted',
      management: {
        operations: [
          'getRuntimeStatus',
          'getApplicationsIds',
          'getApplicationDetails'
        ]
      }
    },
    {
      id: 'unprivileged',
      path: 'unprivileged'
    }
  ]
}
