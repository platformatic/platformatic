// The application is the one the tests reach over HTTP. The tests that replace it ask for a fixed
// port, so that its worker is stopped before the replacement is started.
export default {
  module: '@platformatic/node',
  server: {
    hostname: '127.0.0.1',
    port: Number(process.env.PLT_TESTS_BLOCKER_PORT ?? 0)
  },
  logger: {
    level: 'info'
  }
}
