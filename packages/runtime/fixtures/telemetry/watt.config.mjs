export default {
  watch: true,
  autoload: {
    path: 'services',
    exclude: ['docs']
  },
  tracing: {
    /*
      The disabled case is this same configuration with the variable set, rather than a second
      configuration file beside this one -- v4 allows one per directory, and the two differed only
      here. `enabled` is a boolean and nothing coerces it, so the string is compared rather than
      passed through.
    */
    enabled: process.env.PLT_TELEMETRY_ENABLED !== 'false',
    applicationName: 'test-runtime',
    version: '1.0.0',
    exporter: {
      type: 'memory'
    }
  }
}
