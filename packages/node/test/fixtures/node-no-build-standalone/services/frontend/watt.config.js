// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/node',
  application: {
    commands: {
      build: 'npm run custom-build',
      development: 'npm run dev',
      production: 'npm run start'
    }
  },
  watch: {
    enabled: true
  },
  server: {
    port: 0
  }
}
