export default async function (app) {
  app.get('/health', async () => {
    return { status: 'ok' }
  })

  return app
}
