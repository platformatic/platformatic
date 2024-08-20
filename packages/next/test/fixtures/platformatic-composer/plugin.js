export default async function (app) {
  app.get('/plugin', async () => {
    return { ok: true }
  })

  app.get('/frontend/plugin', async () => {
    return { ok: true }
  })
}
