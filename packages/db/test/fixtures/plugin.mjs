export default async function (app) {
  app.get('/test', {}, async function (request, response) {
    return { res: 'plugin, version 1' }
  })
}
