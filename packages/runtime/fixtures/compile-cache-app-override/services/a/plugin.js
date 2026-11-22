export default async function (app) {
  app.get('/hello', async () => {
    return { hello: 'world' }
  })
}
