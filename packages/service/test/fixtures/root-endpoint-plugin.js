export default async function (app) {
  app.get('/', async function () {
    return { message: 'Root Plugin' }
  })
}
