// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  managementApi: false,
  autoload: {
    path: '../../monorepo-with-node',
    exclude: [
      'docs',
      'composerApp'
    ],
    mappings: {
      serviceAppWithLogger: {
        id: 'with-logger'
      },
      serviceAppWithMultiplePlugins: {
        id: 'multi-plugin-service'
      },
      dbApp: {
        id: 'db-app'
      }
    }
  },
  telemetry: {
    applicationName: 'test-telemetry',
    exporter: {
      type: 'otlp',
      options: {
        url: 'http://127.0.0.1:3044/risk-service/v1/traces'
      }
    }
  }
}
