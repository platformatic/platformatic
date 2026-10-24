// Converted from v3 JSON by scripts/convert-fixtures.mjs
export default {
  autoload: {
    path: './services'
  },
  logger: {
    level: 'info'
  },
  undici: {
    interceptors: [
      {
        module: 'undici-oidc-interceptor',
        options: {
          idpTokenUrl: process.env.PLT_IDP_TOKEN_URL,
          refreshToken: process.env.PLT_REFRESH_TOKEN,
          urls: [
            process.env.PLT_EXTERNAL_SERVICE
          ],
          clientId: 'my-client-id'
        }
      }
    ]
  }
}
