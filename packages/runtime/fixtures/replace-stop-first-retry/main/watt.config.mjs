// The application does not reuse its TCP port, so a replacement stops the old worker first, and it
// needs a fixed port for that: the tests provide one.
export default {
  module: '@platformatic/node',
  server: {
    hostname: '127.0.0.1',
    port: Number(process.env.PLT_TESTS_REPLACE_PORT ?? 0),
    portAssignment: process.env.PLT_TESTS_REPLACE_PORT_ASSIGNMENT ?? 'sameForAllWorkers'
  },
  logger: {
    level: 'info'
  }
}
