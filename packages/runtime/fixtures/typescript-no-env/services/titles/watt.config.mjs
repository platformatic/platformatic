// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/service',
  server: {
    hostname: process.env.PLT_SERVER_HOSTNAME,
    port: Number(process.env.PORT),
    logger: {
      level: process.env.PLT_SERVER_LOGGER_LEVEL
    }
  },
  service: {
    openapi: true
  },
  plugins: {
    paths: [
      {
        path: './plugins',
        encapsulate: false
      },
      './routes'
    ]
  },
  clients: [
    {
      schema: 'client/client.openapi.json',
      name: 'client',
      type: 'openapi',
      serviceId: 'movies'
    }
  ]
}
