export default async function (app, options) {
  app.get('/options', async () => {
    return {
      resolvedBaseUrl: options.resolvedBaseUrl,
      resolvedClientId: options.resolvedClientId,
      cacheUrl: options.cacheUrl
    }
  })
}
