export default async function (app) {
  app.get('/request-id', async (req, res) => {
    return {
      request_id: req.id
    }
  })
}
