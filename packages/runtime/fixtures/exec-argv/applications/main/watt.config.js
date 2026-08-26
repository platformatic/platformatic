// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/node',
  runtime: {
    application: {
      execArgv: [
        '--import',
        './fixtures/exec-argv/applications/main/import.js'
      ]
    }
  },
  server: {
    hostname: '127.0.0.1',
    port: 0
  }
}
