// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  autoload: {
    path: './services'
  },
  logger: {
    level: 'trace'
  },
  metrics: true,
  scheduler: [
    {
      name: 'control-test',
      cron: '0 0 1 1 *',
      callbackUrl: 'http://service-1.plt.local/',
      method: 'GET'
    }
  ],
  managementApi: true
}
