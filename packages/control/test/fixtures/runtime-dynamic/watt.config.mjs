export default {
  watch: false,
  autoload: {
    path: './services'
  },
  logger: {
    level: 'trace'
  },
  metrics: true,
  managementApi: true,
  workers: {
    dynamic: true,
    minimum: 1,
    maximum: 2,
    total: 4
  }
}
