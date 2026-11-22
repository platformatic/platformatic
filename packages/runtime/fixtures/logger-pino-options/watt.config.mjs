// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  autoload: {
    path: 'services'
  },
  watch: false,
  managementApi: false,
  logger: {
    level: 'custom',
    customLevels: {
      custom: 25
    },
    msgPrefix: '[PLT] ',
    nestedKey: 'payload',
    errorKey: 'error',
    redact: {
      paths: ['secret'],
      remove: true
    }
  }
}
