// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  env: {
    FROM_MAIN_CONFIG_FILE: 'true',
    OVERRIDE_TEST: 'top-level'
  },
  logger: {
    level: 'trace'
  },
  applications: [
    {
      id: 'hello',
      path: 'services/hello',
      envfile: 'services/hello/test.env',
      env: {
        FROM_SERVICE_CONFIG_FILE: 'true',
        OVERRIDE_TEST: 'service-override'
      },
      logger: {
        level: 'trace'
      }
    }
  ]
}
