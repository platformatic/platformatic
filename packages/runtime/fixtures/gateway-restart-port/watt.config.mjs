// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  managementApi: true,
  restartOnError: 500,
  reuseTcpPorts: false,
  autoload: {
    path: '.',
    exclude: [
      'extra-service'
    ]
  },
  logger: {
    level: 'debug'
  }
}
