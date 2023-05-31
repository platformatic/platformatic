export default async function (app, options) {
  app.get('/plugin2', async () => {
    return { hello: options.name }
  })
}
