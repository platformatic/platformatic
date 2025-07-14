export default async function (app) {
  app.get('/', async () => {
    return { hello: 'world' }
  })
}
