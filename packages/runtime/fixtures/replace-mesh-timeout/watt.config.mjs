// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  watch: false,
  restartOnError: 500,
  applications: [
    {
      id: 'blocker',
      path: './blocker'
    },
    {
      id: 'target',
      path: './target'
    }
  ],
  logger: {
    level: 'trace'
  }
}
