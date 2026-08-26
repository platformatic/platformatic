// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/gateway',
  server: {
    hostname: '127.0.0.1',
    port: 0,
    logger: {
      level: 'info'
    },
    pluginTimeout: 0
  },
  gateway: {
    applications: [
      {
        id: 'service-1',
        openapi: {
          url: '/documentation/json',
          prefix: '/service-1'
        }
      },
      {
        id: 'external-service-1',
        origin: 'http://external-dependency-1',
        openapi: {
          file: './external-service.schema.json',
          prefix: '/external-service-1'
        }
      }
    ]
  },
  clients: [
    {
      schema: './clients/service-1/schema.json',
      serviceId: 'service-1',
      name: 'service1',
      type: 'openapi',
      url: process.env.PLT_SERVICE1_URL
    },
    {
      path: './clients/service-2',
      name: 'service2',
      type: 'openapi',
      url: process.env.PLT_SERVICE2_URL
    }
  ],
  watch: false
}
