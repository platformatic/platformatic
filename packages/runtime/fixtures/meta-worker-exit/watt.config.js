// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  workers: 2,
  restartOnError: false,
  preload: 'preload.js',
  applications: [
    {
      id: 'service',
      path: './service'
    },
    {
      id: 'dummy',
      path: './service'
    }
  ]
}
