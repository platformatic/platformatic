export default async function (app) {
  app.get('/check', async function checkRoute () {
    return { ok: true }
  })
}
