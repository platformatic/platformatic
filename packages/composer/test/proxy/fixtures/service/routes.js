module.exports = async function (app) {
  app.get('/hello', async () => {
    return { ok: true }
  })

  app.post('/echo', async (req) => {
    return req.body
  })
}
