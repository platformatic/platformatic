/* globals platformatic */
platformatic.setBasePath('from-code')

module.exports = async function (app) {
  app.get('/hello', async () => {
    return { ok: true }
  })
}
