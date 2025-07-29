export default async function (app) {
  app.get('/', async req => {
    return req.hello.get()
  })
}
