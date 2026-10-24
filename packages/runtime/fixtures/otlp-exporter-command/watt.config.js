// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  autoload: {
    path: './services'
  },
  metrics: {
    hostname: '127.0.0.1',
    port: 9090,
    otlpExporter: {
      endpoint: `http://127.0.0.1:${process.env.PLT_OTLP_PORT}/v1/metrics`,
      interval: 1000,
      serviceName: 'test-service-command',
      serviceVersion: '1.0.0'
    }
  }
}
