// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  module: '@platformatic/service',
  service: {
    openapi: true
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
    packages: [
      {
        name: '@fastify/oauth2',
        options: {
          name: process.env.PLT_RIVAL_FST_PLUGIN_OAUTH2_NAME,
          credentials: {
            client: {
              id: process.env.PLT_RIVAL_FST_PLUGIN_OAUTH2_CREDENTIALS_CLIENT_ID,
              secret: process.env.PLT_RIVAL_FST_PLUGIN_OAUTH2_CREDENTIALS_CLIENT_SECRET
            }
          },
          startRedirectPath: process.env.PLT_RIVAL_FST_PLUGIN_OAUTH2_REDIRECT_PATH,
          callbackUri: process.env.PLT_RIVAL_FST_PLUGIN_OAUTH2_CALLBACK_URI
        }
      }
    ]
  },
  server: {
    hostname: process.env.PLT_SERVER_HOSTNAME,
    port: Number(process.env.PORT),
    logger: {
      level: process.env.PLT_SERVER_LOGGER_LEVEL
    }
  }
}
