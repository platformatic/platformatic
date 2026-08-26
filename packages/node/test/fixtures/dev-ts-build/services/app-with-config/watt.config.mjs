// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/service',
  server: {
    hostname: '127.0.0.1'
  },
  watch: true,
  plugins: {
    paths: [
      {
        path: './plugins',
        encapsulate: false
      },
      './routes'
    ],
    typescript: true
  }
}
