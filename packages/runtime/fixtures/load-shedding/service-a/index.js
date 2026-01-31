export default async function (app) {
  app.get('/health', async () => {
    return { status: 'ok' }
  })

  app.get('/call-service-b', async (_, reply) => {
    const res = await fetch('http://service-b.plt.local/health')
    reply.status(res.status)
    return res.json()
  })

  return app
}
